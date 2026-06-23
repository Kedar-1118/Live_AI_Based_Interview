import unittest
import json
import uuid
import math
from datetime import datetime, timezone

from test.backend.test_helpers import (
    init_test_db,
    clean_test_db,
    TestingSessionLocal,
    create_test_user,
    create_test_session,
)
from app.models.integrity import Baseline, IntegrityEvent, Score
from app.models.exchange import Exchange
from app.services.speech_analyzer import WPMSegment
from app.services.integrity_engine import (
    process_behavioral_signal,
    compute_gaze_fluency_correlation,
    update_integrity_score,
)


class TestIntegrityEngine(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await init_test_db()
        self.db = TestingSessionLocal()
        self.user = await create_test_user(self.db)
        self.session = await create_test_session(self.db, self.user.id)

        # Create active exchange
        self.exchange = Exchange(
            session_id=self.session.id,
            question="What is regular expression?",
            question_index=0,
        )
        self.db.add(self.exchange)
        await self.db.commit()
        await self.db.refresh(self.exchange)

        # Create baseline
        self.baseline = Baseline(
            session_id=self.session.id,
            avg_wpm=150.0,
            wpm_std_dev=15.0,
            gaze_center_x=0.5,
            gaze_center_y=0.5,
            gaze_std_dev=0.1,
            head_pose_range=json.dumps({"yaw": [-10, 10], "pitch": [-10, 10]}),
        )
        self.db.add(self.baseline)
        await self.db.commit()

    async def asyncTearDown(self):
        await self.db.close()
        await clean_test_db()

    async def test_process_behavioral_signal_custom_event(self):
        signal = {
            "event_type": "tab_switch",
            "severity": "medium",
            "metadata": {"message": "User Alt-Tabbed"},
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
        }

        await process_behavioral_signal(self.session.id, signal, self.db)

        # Verify event logged in DB
        result = await self.db.execute(
            select = getattr(self.db, "execute") # just normal query
        )
        from sqlalchemy import select
        evts = (await self.db.execute(select(IntegrityEvent).where(IntegrityEvent.session_id == self.session.id))).scalars().all()
        self.assertEqual(len(evts), 1)
        self.assertEqual(evts[0].event_type, "tab_switch")
        self.assertEqual(evts[0].severity, "medium")

    async def test_process_behavioral_signal_face_missing(self):
        signal = {
            "face_count": 0,
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
        }

        await process_behavioral_signal(self.session.id, signal, self.db)

        from sqlalchemy import select
        evts = (await self.db.execute(select(IntegrityEvent).where(IntegrityEvent.event_type == "face_missing"))).scalars().all()
        self.assertEqual(len(evts), 1)

    async def test_process_behavioral_signal_multiple_faces(self):
        signal = {
            "face_count": 2,
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
        }

        await process_behavioral_signal(self.session.id, signal, self.db)

        from sqlalchemy import select
        evts = (await self.db.execute(select(IntegrityEvent).where(IntegrityEvent.event_type == "multiple_faces"))).scalars().all()
        self.assertEqual(len(evts), 1)

    async def test_process_behavioral_signal_gaze_deviation(self):
        # We need sustained signals in buffer.
        # Let's send 5 signals deviating to the right (x > 0.85) over 4 seconds
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        for i in range(5):
            signal = {
                "face_count": 1,
                "gaze": {"x": 0.9, "y": 0.5},
                "head_pose": {"yaw": 5.0, "pitch": 0.0},
                "timestamp": now_ms - (4000 - i * 1000)
            }
            await process_behavioral_signal(self.session.id, signal, self.db)

        from sqlalchemy import select
        evts = (await self.db.execute(select(IntegrityEvent).where(IntegrityEvent.event_type == "second_monitor_right"))).scalars().all()
        self.assertEqual(len(evts), 1)

    async def test_compute_gaze_fluency_correlation(self):
        # Setup: Let's create an exchange and associate it with gaze deviations
        # and fluency spikes to show correlation.
        # Assume audio start time matches exchange creation.
        audio_start = int(self.exchange.created_at.replace(tzinfo=timezone.utc).timestamp() * 1000)

        # Write some gaze deviations in the database:
        # One right before a WPM segment (within 5 seconds)
        # Segments:
        # Segment 1: start=3.0s (timestamp 3000ms after audio start)
        # Gaze event 1: 1000ms after audio start (inside the 5s window before segment 1)
        # Segment 2: start=10.0s (timestamp 10000ms after audio start)
        # Gaze event 2: 7000ms after audio start (inside the 5s window before segment 2)
        evt1 = IntegrityEvent(
            session_id=self.session.id,
            exchange_id=self.exchange.id,
            event_type="gaze_deviation",
            timestamp_ms=audio_start + 1000,
            severity="low"
        )
        evt2 = IntegrityEvent(
            session_id=self.session.id,
            exchange_id=self.exchange.id,
            event_type="gaze_deviation",
            timestamp_ms=audio_start + 7000,
            severity="low"
        )
        self.db.add_all([evt1, evt2])
        await self.db.commit()

        # Create WPM segments:
        # Segment 1: WPM 160 (gaze deviation present before)
        # Segment 2: WPM 170 (gaze deviation present before)
        # Segment 3: WPM 100 (no gaze deviation before, say at start=25.0s)
        wpm_segs = [
            WPMSegment(start=3.0, end=4.0, wpm=160.0, word_count=10),
            WPMSegment(start=10.0, end=11.0, wpm=170.0, word_count=10),
            WPMSegment(start=25.0, end=26.0, wpm=100.0, word_count=10),
        ]

        correlation = await compute_gaze_fluency_correlation(
            session_id=self.session.id,
            exchange_id=self.exchange.id,
            wpm_segments=wpm_segs,
            db=self.db,
        )

        self.assertTrue(isinstance(correlation, float))
        # Correlation between [1, 1, 0] (deviation presence) and [160, 170, 100] (wpm)
        # This has positive correlation.
        self.assertGreater(correlation, 0.0)

    async def test_update_integrity_score(self):
        # Setup: Log some unique events during the session
        evt1 = IntegrityEvent(
            session_id=self.session.id,
            event_type="tab_switch",
            timestamp_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
            severity="medium"
        )
        evt2 = IntegrityEvent(
            session_id=self.session.id,
            event_type="notes_below_camera",
            timestamp_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
            severity="medium"
        )
        self.db.add_all([evt1, evt2])
        await self.db.commit()

        # Update score with moderate correlation (0.6)
        # Deductions:
        # - Correlation > 0.5: -12
        # - tab_switch: -15
        # - notes_below_camera: -15
        # Total deduction: -42 => new score: 58
        new_score = await update_integrity_score(
            session_id=self.session.id,
            correlation=0.6,
            exchange_id=self.exchange.id,
            db=self.db,
        )

        self.assertEqual(new_score, 58)

        # Retrieve session to check persistence
        from sqlalchemy import select
        sess = (await self.db.execute(select(Session).where(Session.id == self.session.id))).scalar_one()
        self.assertEqual(sess.integrity_score, 58)


if __name__ == "__main__":
    unittest.main()
