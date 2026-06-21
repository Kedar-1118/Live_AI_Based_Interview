import json
import os
import uuid
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.session import Session
from app.models.exchange import Exchange
from app.models.integrity import Score, Baseline, IntegrityEvent
from app.schemas.schemas import (
    SessionCreate, SessionResponse, SessionSummary,
    CalibrationCompleteRequest, BaselineResponse
)
from app.services.interviewer_agent import generate_first_question
from app.services.transcription_service import transcribe_audio
from app.services.speech_analyzer import analyze_speech

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("/create", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    request: SessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new interview session and generate the first question."""
    session = Session(
        user_id=user.id,
        topic=request.topic,
        difficulty=request.difficulty,
        duration_minutes=request.duration_minutes,
        total_questions=request.total_questions,
    )
    db.add(session)
    await db.flush()

    # Generate the first question
    first_question = await generate_first_question(
        topic=request.topic,
        difficulty=request.difficulty,
    )

    # Create the first exchange (question only, no answer yet)
    exchange = Exchange(
        session_id=session.id,
        question=first_question,
        question_index=1,
    )
    db.add(exchange)
    await db.flush()

    # Eagerly re-load with exchanges + scores
    result = await db.execute(
        select(Session)
        .where(Session.id == session.id)
        .options(selectinload(Session.exchanges).selectinload(Exchange.score))
    )
    session = result.scalar_one()

    return SessionResponse.model_validate(session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get session details with all exchanges."""
    result = await db.execute(
        select(Session)
        .where(Session.id == session_id, Session.user_id == user.id)
        .options(selectinload(Session.exchanges).selectinload(Exchange.score))
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return SessionResponse.model_validate(session)


@router.patch("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """End an active session."""
    result = await db.execute(
        select(Session)
        .where(Session.id == session_id, Session.user_id == user.id)
        .options(selectinload(Session.exchanges).selectinload(Exchange.score))
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is already ended",
        )

    session.status = "completed"
    session.ended_at = datetime.now(timezone.utc)
    await db.flush()

    return SessionResponse.model_validate(session)


@router.post("/{session_id}/calibration/submit")
async def submit_calibration_audio(
    session_id: UUID,
    audio: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate session exists and belongs to user
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")

    content = await audio.read()
    settings = get_settings()
    calib_dir = os.path.join(settings.UPLOAD_DIR, "calibration", str(session_id))
    os.makedirs(calib_dir, exist_ok=True)
    
    # Generate unique path
    import uuid as uuid_pkg
    audio_path = os.path.join(calib_dir, f"{uuid_pkg.uuid4()}.webm")
    with open(audio_path, "wb") as f:
        f.write(content)

    # Transcribe and analyze
    transcription_result = await transcribe_audio(audio_path)
    speech_analysis = analyze_speech(
        word_timestamps=transcription_result.word_timestamps,
        transcript=transcription_result.transcript,
    )

    return {
        "wpm": speech_analysis.avg_wpm,
        "transcript": transcription_result.transcript,
    }


@router.post("/{session_id}/calibration/complete")
async def complete_calibration(
    session_id: UUID,
    request: CalibrationCompleteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate session
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check if baseline already exists
    baseline_result = await db.execute(
        select(Baseline).where(Baseline.session_id == session_id)
    )
    baseline = baseline_result.scalar_one_or_none()

    head_pose_json = json.dumps(request.head_pose_range.model_dump())

    if baseline:
        baseline.avg_wpm = request.avg_wpm
        baseline.wpm_std_dev = request.wpm_std_dev
        baseline.gaze_center_x = request.gaze_center_x
        baseline.gaze_center_y = request.gaze_center_y
        baseline.gaze_std_dev = request.gaze_std_dev
        baseline.head_pose_range = head_pose_json
    else:
        baseline = Baseline(
            session_id=session_id,
            avg_wpm=request.avg_wpm,
            wpm_std_dev=request.wpm_std_dev,
            gaze_center_x=request.gaze_center_x,
            gaze_center_y=request.gaze_center_y,
            gaze_std_dev=request.gaze_std_dev,
            head_pose_range=head_pose_json,
        )
        db.add(baseline)

    await db.flush()
    return {"status": "success", "message": "Calibration baseline saved successfully"}


@router.get("/{session_id}/baseline", response_model=BaselineResponse)
async def get_session_baseline(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate session
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    baseline_result = await db.execute(
        select(Baseline).where(Baseline.session_id == session_id)
    )
    baseline = baseline_result.scalar_one_or_none()
    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline calibration not found for this session")

    return baseline


@router.get("/{session_id}/report")
async def get_session_report(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch session with exchanges and scores
    result = await db.execute(
        select(Session)
        .where(Session.id == session_id, Session.user_id == user.id)
        .options(selectinload(Session.exchanges).selectinload(Exchange.score))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Fetch all integrity events
    events_result = await db.execute(
        select(IntegrityEvent)
        .where(IntegrityEvent.session_id == session_id)
        .order_by(IntegrityEvent.timestamp_ms)
    )
    events = events_result.scalars().all()

    # Determine Verdict
    verdict = "EXCELLENT"
    if session.integrity_score < 70:
        verdict = "SUSPICIOUS"
    elif session.integrity_score < 85:
        verdict = "REVIEW_RECOMMENDED"

    # Construct timeline
    timeline = []
    session_start_ms = int(session.started_at.replace(tzinfo=timezone.utc).timestamp() * 1000)

    # Group events by exchange_id (or general if none)
    exchange_events = {}
    for evt in events:
        eid = evt.exchange_id or "general"
        if eid not in exchange_events:
            exchange_events[eid] = []
        
        # Format relative timestamp MM:SS
        rel_ms = evt.timestamp_ms - session_start_ms
        rel_sec = max(0, int(rel_ms // 1000))
        time_str = f"{rel_sec // 60:02d}:{rel_sec % 60:02d}"

        try:
            meta = json.loads(evt.metadata_json) if evt.metadata_json else {}
        except Exception:
            meta = {}

        exchange_events[eid].append({
            "type": evt.event_type,
            "severity": evt.severity,
            "timestamp": time_str,
            "metadata": meta
        })

    # For each exchange in session, build question record with its flags
    for ex in session.exchanges:
        flags = exchange_events.get(ex.id, [])
        suspicion = "low"
        if any(f["severity"] == "high" for f in flags):
            suspicion = "high"
        elif any(f["severity"] == "medium" for f in flags) or len(flags) > 2:
            suspicion = "moderate"

        timeline.append({
            "question_index": ex.question_index,
            "question": ex.question,
            "flags": flags,
            "suspicion_level": suspicion
        })

    # Add general/calibration phase flags if any
    general_flags = exchange_events.get("general", [])
    if general_flags:
        timeline.insert(0, {
            "question_index": 0,
            "question": "Baseline Calibration & Setup",
            "flags": general_flags,
            "suspicion_level": "moderate" if any(f["severity"] == "high" or f["severity"] == "medium" for f in general_flags) else "low"
        })

    # Gather correlations
    correlations = [
        ex.score.gaze_fluency_correlation 
        for ex in session.exchanges 
        if ex.score and ex.score.gaze_fluency_correlation is not None
    ]
    avg_correlation = sum(correlations) / len(correlations) if correlations else 0.0

    # Count consistent deviation directions
    deviation_types = [evt.event_type for evt in events if evt.event_type in ["notes_below_camera", "second_monitor_left", "second_monitor_right"]]
    dominant_suspicious_zone = "none"
    if deviation_types:
        dominant_suspicious_zone = max(set(deviation_types), key=deviation_types.count)

    summary_text = "No significant cheating patterns detected."
    if session.integrity_score < 100:
        if avg_correlation > 0.5:
            summary_text = f"Candidate showed a notable gaze-fluency correlation ({avg_correlation:.2f}) preceding fluent answers. "
        else:
            summary_text = "Candidate showed behavioral anomalies. "
        
        if dominant_suspicious_zone != "none":
            friendly_zone = dominant_suspicious_zone.replace("_", " ")
            summary_text += f"Dominant suspicious zone: {friendly_zone}."

    return {
        "session_id": session.id,
        "integrity_score": session.integrity_score,
        "verdict": verdict,
        "timeline": timeline,
        "pattern_analysis": {
            "gaze_fluency_correlation": round(avg_correlation, 2),
            "consistent_deviation_direction": len(set(deviation_types)) == 1 if deviation_types else False,
            "dominant_suspicious_zone": dominant_suspicious_zone,
            "summary": summary_text
        }
    }
