import unittest
import uuid
import json
from fastapi.testclient import TestClient
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


class TestSessionsRouter(unittest.TestCase):
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
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        import asyncio
        asyncio.run(self.db.close())
        app.dependency_overrides.clear()
        asyncio.run(clean_test_db())

    def test_create_session(self):
        response = self.client.post(
            "/sessions/create",
            json={
                "topic": "Machine Learning",
                "difficulty": "medium",
                "duration_minutes": 30,
                "total_questions": 5,
            },
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["topic"], "Machine Learning")
        self.assertEqual(data["status"], "active")
        self.assertEqual(len(data["exchanges"]), 1)
        self.assertEqual(data["exchanges"][0]["question_index"], 1)

    def test_get_session(self):
        # Create session in DB
        import asyncio
        session = asyncio.run(create_test_session(self.db, self.user.id))

        response = self.client.get(
            f"/sessions/{session.id}",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id"], str(session.id))
        self.assertEqual(data["topic"], "Machine Learning")

    def test_get_session_not_found(self):
        random_id = uuid.uuid4()
        response = self.client.get(
            f"/sessions/{random_id}",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 404)

    def test_end_session(self):
        import asyncio
        session = asyncio.run(create_test_session(self.db, self.user.id))

        response = self.client.patch(
            f"/sessions/{session.id}/end",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "completed")

    def test_calibration_complete_and_get_baseline(self):
        import asyncio
        session = asyncio.run(create_test_session(self.db, self.user.id))

        # Complete calibration
        response = self.client.post(
            f"/sessions/{session.id}/calibration/complete",
            json={
                "avg_wpm": 140.5,
                "wpm_std_dev": 12.0,
                "gaze_center_x": 0.52,
                "gaze_center_y": 0.48,
                "gaze_std_dev": 0.08,
                "head_pose_range": {
                    "yaw": [-12.0, 11.5],
                    "pitch": [-8.0, 9.0],
                },
            },
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "success")

        # Retrieve baseline
        response_baseline = self.client.get(
            f"/sessions/{session.id}/baseline",
            headers=self.headers,
        )
        self.assertEqual(response_baseline.status_code, 200)
        data = response_baseline.json()
        self.assertEqual(data["avg_wpm"], 140.5)
        self.assertEqual(data["gaze_center_x"], 0.52)

    def test_get_report(self):
        import asyncio
        session = asyncio.run(create_test_session(self.db, self.user.id))

        response = self.client.get(
            f"/sessions/{session.id}/report",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["session_id"], str(session.id))
        self.assertEqual(data["integrity_score"], 100)
        self.assertEqual(data["verdict"], "EXCELLENT")


if __name__ == "__main__":
    unittest.main()
