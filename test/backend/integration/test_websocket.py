import unittest
import uuid
import json
from fastapi.testclient import TestClient, WebSocketDisconnect
from app.main import app
from app.db.database import get_db
from app.services.auth_service import create_access_token
from test.backend.test_helpers import (
    init_test_db,
    clean_test_db,
    override_get_db,
    create_test_user,
    create_test_session,
    TestingSessionLocal,
)


class TestWebSocket(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

        # Initialize DB
        import asyncio
        asyncio.run(init_test_db())

        # Create user & auth token
        self.db = TestingSessionLocal()
        import asyncio
        self.user = asyncio.run(create_test_user(self.db))
        self.token = create_access_token(self.user.id)

        # Create session
        import asyncio
        self.session = asyncio.run(create_test_session(self.db, self.user.id))

    def tearDown(self):
        import asyncio
        asyncio.run(self.db.close())
        app.dependency_overrides.clear()
        asyncio.run(clean_test_db())

    def test_ws_invalid_session_id(self):
        with self.assertRaises(WebSocketDisconnect) as context:
            with self.client.websocket_connect("/ws/not-a-uuid?token=dummy"):
                pass
        self.assertEqual(context.exception.code, 4000)

    def test_ws_missing_token(self):
        with self.assertRaises(WebSocketDisconnect) as context:
            with self.client.websocket_connect(f"/ws/{self.session.id}"):
                pass
        self.assertEqual(context.exception.code, 4008)

    def test_ws_invalid_token(self):
        with self.assertRaises(WebSocketDisconnect) as context:
            with self.client.websocket_connect(f"/ws/{self.session.id}?token=invalidtoken"):
                pass
        self.assertEqual(context.exception.code, 4003)

    def test_ws_connect_success_and_heartbeat(self):
        # Successful connection
        with self.client.websocket_connect(f"/ws/{self.session.id}?token={self.token}") as ws:
            # Send heartbeat
            ws.send_json({"type": "heartbeat"})
            response = ws.receive_json()
            self.assertEqual(response, {"type": "ack"})

    def test_ws_behavioral_signal(self):
        # Setup: Create a baseline in database so gaze monitoring path doesn't early-exit
        from app.models.integrity import Baseline
        baseline = Baseline(
            session_id=self.session.id,
            gaze_center_x=0.5,
            gaze_center_y=0.5,
            gaze_std_dev=0.1
        )
        self.db.add(baseline)
        import asyncio
        asyncio.run(self.db.commit())

        # Connect and stream signal
        with self.client.websocket_connect(f"/ws/{self.session.id}?token={self.token}") as ws:
            ws.send_json({
                "type": "behavioral_signal",
                "payload": {
                    "face_count": 0,  # should trigger face_missing event
                    "timestamp": 1234567890
                }
            })
            # Wait a split second, connection remains open since it's just logged
            ws.send_json({"type": "heartbeat"})
            self.assertEqual(ws.receive_json(), {"type": "ack"})

        # Verify event was logged in database
        from sqlalchemy import select
        from app.models.integrity import IntegrityEvent
        import asyncio
        
        async def verify_db():
            async with TestingSessionLocal() as session:
                evts = (await session.execute(
                    select(IntegrityEvent).where(IntegrityEvent.session_id == self.session.id)
                )).scalars().all()
                return evts
                
        events = asyncio.run(verify_db())
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].event_type, "face_missing")


if __name__ == "__main__":
    unittest.main()
