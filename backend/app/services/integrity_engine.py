import json
import logging
import math
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from scipy.stats import pearsonr

from app.models.integrity import Baseline, IntegrityEvent
from app.models.session import Session
from app.models.exchange import Exchange
from app.services.websocket_manager import manager

logger = logging.getLogger(__name__)

# Sliding window buffer for real-time gaze & head pose tracking
# Format: session_id -> list of dicts (signals)
session_buffers: dict[str, list[dict]] = {}
MAX_BUFFER_DURATION_S = 15  # keep last 15 seconds of signals


def _get_buffer(session_id: str) -> list[dict]:
    if session_id not in session_buffers:
        session_buffers[session_id] = []
    return session_buffers[session_id]


def _cleanup_buffer(session_id: str, current_ts_ms: int):
    buffer = _get_buffer(session_id)
    cutoff = current_ts_ms - (MAX_BUFFER_DURATION_S * 1000)
    # Filter out old signals
    session_buffers[session_id] = [s for s in buffer if s.get("timestamp", 0) > cutoff]


async def process_behavioral_signal(
    session_id: UUID,
    signal: dict,
    db: AsyncSession,
) -> None:
    """
    Process an incoming real-time behavioral signal from the WebSocket.
    Detects face count anomalies and gaze/head pose deviations against the baseline.
    Logs events to the database and alerts the client via WebSocket.
    """
    session_id_str = str(session_id)
    current_ts = signal.get("timestamp", int(datetime.now(timezone.utc).timestamp() * 1000))

    # Add signal to buffer
    buffer = _get_buffer(session_id_str)
    buffer.append(signal)
    _cleanup_buffer(session_id_str, current_ts)

    # 1. Face Count Check
    face_count = signal.get("face_count", 1)
    event_type = None
    severity = None
    metadata = {}

    if face_count == 0:
        event_type = "face_missing"
        severity = "medium"
        metadata = {"message": "Candidate face not detected in frame"}
    elif face_count > 1:
        event_type = "multiple_faces"
        severity = "high"
        metadata = {"face_count": face_count, "message": "Multiple faces detected"}

    if event_type:
        await _log_and_notify_event(session_id, event_type, severity, current_ts, metadata, db)
        return

    # 2. Gaze and Head Pose Check (Requires Baseline)
    # Fetch baseline from db
    result = await db.execute(
        select(Baseline).where(Baseline.session_id == session_id)
    )
    baseline = result.scalar_one_or_none()
    if not baseline:
        # Still in calibration or baseline not set up
        return

    gaze = signal.get("gaze")
    head_pose = signal.get("head_pose")

    if not gaze or not head_pose:
        return

    gaze_x = gaze.get("x", 0.5)
    gaze_y = gaze.get("y", 0.5)
    yaw = head_pose.get("yaw", 0.0)
    pitch = head_pose.get("pitch", 0.0)

    # Compute deviation from natural center
    dev_x = gaze_x - (baseline.gaze_center_x or 0.5)
    dev_y = gaze_y - (baseline.gaze_center_y or 0.5)
    total_deviation = math.sqrt(dev_x**2 + dev_y**2)

    gaze_std_dev = baseline.gaze_std_dev or 0.1
    # Check if deviation exceeds threshold (2 std devs)
    if total_deviation > gaze_std_dev * 2:
        # Check sustained deviation in the sliding buffer
        # Let's inspect the buffer for the last 3 seconds
        three_secs_ago = current_ts - 3000
        recent_signals = [s for s in buffer if s.get("timestamp", 0) >= three_secs_ago]

        # Count how many of these show a deviation in the same direction
        deviating_count = 0
        direction_x_sum = 0
        direction_y_sum = 0

        for s in recent_signals:
            sg = s.get("gaze")
            if not sg:
                continue
            sx_dev = sg.get("x", 0.5) - (baseline.gaze_center_x or 0.5)
            sy_dev = sg.get("y", 0.5) - (baseline.gaze_center_y or 0.5)
            s_dev = math.sqrt(sx_dev**2 + sy_dev**2)
            if s_dev > gaze_std_dev * 2:
                deviating_count += 1
                direction_x_sum += 1 if sx_dev > 0 else -1
                direction_y_sum += 1 if sy_dev > 0 else -1

        # If sustained (>80% of signals in the last 3s deviate in the same direction)
        if len(recent_signals) >= 2 and (deviating_count / len(recent_signals)) >= 0.8:
            # Determine direction of deviation
            net_x = direction_x_sum / len(recent_signals)
            net_y = direction_y_sum / len(recent_signals)

            # Classify suspicious zone
            # Notes below camera: looking down, pitch tilted forward
            if gaze_y > 0.80 and pitch > 20:
                event_type = "notes_below_camera"
                severity = "medium"
                metadata = {"message": "Candidate looking down at potential notes", "pitch": pitch, "gaze_y": gaze_y}
            # Second monitor left: gaze shifted left
            elif gaze_x < 0.15:
                event_type = "second_monitor_left"
                severity = "medium"
                metadata = {"message": "Gaze shifted to second monitor (left)", "gaze_x": gaze_x}
            # Second monitor right: gaze shifted right
            elif gaze_x > 0.85:
                event_type = "second_monitor_right"
                severity = "medium"
                metadata = {"message": "Gaze shifted to second monitor (right)", "gaze_x": gaze_x}
            # General gaze deviation
            else:
                event_type = "gaze_deviation"
                severity = "low"
                metadata = {"message": "Sustained gaze deviation", "deviation_magnitude": total_deviation}

            # Check if we should log (rate limit to once per 8 seconds of the same event type to prevent database flood)
            await _log_and_notify_event_if_new(session_id, event_type, severity, current_ts, metadata, db)


async def _log_and_notify_event(
    session_id: UUID,
    event_type: str,
    severity: str,
    timestamp_ms: int,
    metadata: dict,
    db: AsyncSession,
) -> None:
    # Find current exchange (active, unanswered) to link it
    exchange_result = await db.execute(
        select(Exchange)
        .where(Exchange.session_id == session_id, Exchange.answer_transcript.is_(None))
        .order_by(Exchange.question_index)
        .limit(1)
    )
    exchange = exchange_result.scalar_one_or_none()
    exchange_id = exchange.id if exchange else None

    # Write to DB
    evt = IntegrityEvent(
        session_id=session_id,
        exchange_id=exchange_id,
        event_type=event_type,
        severity=severity,
        timestamp_ms=timestamp_ms,
        metadata_json=json.dumps(metadata),
    )
    db.add(evt)
    await db.flush()

    # Notify client via WS
    payload = {
        "type": "integrity_alert",
        "payload": {
            "event_type": event_type,
            "severity": severity,
            "timestamp_ms": timestamp_ms,
            "metadata": metadata,
        }
    }
    await manager.send_personal_message(payload, str(session_id))
    logger.warning(f"Integrity Event Logged: {event_type} (severity={severity}) for session {session_id}")


async def _log_and_notify_event_if_new(
    session_id: UUID,
    event_type: str,
    severity: str,
    timestamp_ms: int,
    metadata: dict,
    db: AsyncSession,
) -> None:
    # Check last event of same type in the last 8 seconds
    eight_secs_ago = timestamp_ms - 8000
    last_event_result = await db.execute(
        select(IntegrityEvent)
        .where(
            IntegrityEvent.session_id == session_id,
            IntegrityEvent.event_type == event_type,
            IntegrityEvent.timestamp_ms >= eight_secs_ago,
        )
        .limit(1)
    )
    last_event = last_event_result.scalar_one_or_none()

    if not last_event:
        await _log_and_notify_event(session_id, event_type, severity, timestamp_ms, metadata, db)


async def compute_gaze_fluency_correlation(
    session_id: UUID,
    exchange_id: UUID,
    wpm_segments: list,  # list of WPMSegment objects
    db: AsyncSession,
) -> float:
    """
    Calculate the gaze-fluency correlation using Pearson correlation coefficient.
    Checks if there were gaze deviations in the 5 seconds preceding each WPM segment.
    """
    if not wpm_segments or len(wpm_segments) < 2:
        return 0.0

    # Retrieve all gaze deviations logged during this exchange
    events_result = await db.execute(
        select(IntegrityEvent).where(
            IntegrityEvent.session_id == session_id,
            IntegrityEvent.exchange_id == exchange_id,
            IntegrityEvent.event_type.in_([
                "gaze_deviation", "notes_below_camera", 
                "second_monitor_left", "second_monitor_right",
                "fixed_reference_point"
            ]),
        )
    )
    events = events_result.scalars().all()

    deviation_presence = []
    fluency_values = []

    # Align by timestamp
    for segment in wpm_segments:
        # Segment start/end are in seconds from the beginning of the audio.
        # Gaze event timestamps are absolute epoch milliseconds.
        # We need relative mapping, but since we don't have the exact audio start epoch time in some records,
        # we can approximate using the exchange's created_at time or use the event timestamps relative to the oldest event.
        # Alternatively, if we store the audio start epoch timestamp, we can align precisely.
        # Let's check: if we have the exchange's created_at timestamp, we can estimate relative audio start.
        # Usually, the exchange is answered right after the question, so audio recording starts roughly at exchange.created_at or when candidate clicks record.
        # Let's fetch the exchange details
        ex_result = await db.execute(select(Exchange).where(Exchange.id == exchange_id))
        exchange = ex_result.scalar_one_or_none()
        if not exchange:
            continue

        audio_start_ms = int(exchange.created_at.replace(tzinfo=timezone.utc).timestamp() * 1000)
        # If there are events recorded before audio start, let's calibrate audio start to the oldest event in this exchange if it exists
        if events:
            oldest_event_ms = min(e.timestamp_ms for e in events)
            if oldest_event_ms < audio_start_ms:
                audio_start_ms = oldest_event_ms

        segment_start_ms = audio_start_ms + int(segment.start * 1000)
        window_start_ms = segment_start_ms - 5000  # 5 seconds before segment start
        window_end_ms = segment_start_ms

        # Find if there was any gaze deviation in this window
        deviations_before = [
            e for e in events
            if window_start_ms <= e.timestamp_ms <= window_end_ms
        ]

        deviation_presence.append(1 if deviations_before else 0)
        fluency_values.append(segment.wpm)

    if len(set(deviation_presence)) < 2 or len(set(fluency_values)) < 2:
        logger.debug("Not enough variance to correlate gaze and fluency")
        return 0.0

    try:
        correlation, p_value = pearsonr(deviation_presence, fluency_values)
        if math.isnan(correlation) or p_value >= 0.05:
            return 0.0
        return float(correlation)
    except Exception as e:
        logger.error(f"Error computing Pearson correlation: {e}")
        return 0.0


async def update_integrity_score(
    session_id: UUID,
    correlation: float,
    exchange_id: UUID,
    db: AsyncSession,
) -> int:
    """
    Calculate deductions and update the overall session integrity score.
    Returns the new score.
    """
    # Fetch session
    sess_result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        return 100

    # Fetch unique event types recorded during the entire session
    events_result = await db.execute(
        select(IntegrityEvent.event_type).where(IntegrityEvent.session_id == session_id)
    )
    event_types = set(events_result.scalars().all())

    deductions = 0

    # 1. Gaze-Fluency Correlation Deduction
    if correlation > 0.7:
        deductions += 25
        logger.warning(f"Session {session_id}: Strong gaze-fluency correlation ({correlation:.2f}) -> Deducting 25")
    elif correlation > 0.5:
        deductions += 12
        logger.warning(f"Session {session_id}: Moderate gaze-fluency correlation ({correlation:.2f}) -> Deducting 12")

    # 2. Event-based deductions (once per unique event type to keep it fair and capped)
    for etype in event_types:
        if etype == "fixed_reference_point":
            deductions += 20
        elif etype == "notes_below_camera":
            deductions += 15
        elif etype in ["second_monitor_left", "second_monitor_right"]:
            deductions += 12  # combined left/right monitors
        elif etype == "multiple_faces":
            deductions += 20
        elif etype == "voice_mismatch":
            deductions += 30
        elif etype == "second_voice_detected":
            deductions += 25
        elif etype == "tab_switch" or etype == "fullscreen_exit":
            deductions += 15

    new_score = max(0, 100 - deductions)
    session.integrity_score = new_score
    await db.flush()

    logger.info(f"Session {session_id} integrity score updated to {new_score} (deductions={deductions})")
    return new_score
