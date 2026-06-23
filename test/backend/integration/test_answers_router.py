import unittest
import uuid
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
from app.models.exchange import Exchange


class TestAnswersRouter(unittest.TestCase):
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

        # Create session and first exchange in DB (representing a session ready for Q1 answer)
        import asyncio
        self.session = asyncio.run(create_test_session(self.db, self.user.id))
        self.exchange = Exchange(
            session_id=self.session.id,
            question="What is unsupervised learning?",
            question_index=1,
        )
        self.db.add(self.exchange)
        asyncio.run(self.db.commit())

    def tearDown(self):
        import asyncio
        asyncio.run(self.db.close())
        app.dependency_overrides.clear()
        asyncio.run(clean_test_db())

    def test_submit_text_answer(self):
        response = self.client.post(
            "/answers/submit",
            json={
                "session_id": str(self.session.id),
                "answer_text": "Unsupervised learning finds patterns in unlabeled data.",
            },
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["exchange_id"], str(self.exchange.id))
        self.assertIn("evaluation", data)
        self.assertIn("technical_accuracy", data["evaluation"])
        self.assertEqual(data["question_index"], 1)

    def test_submit_audio_answer(self):
        # Prepare a mock audio upload
        audio_data = b"RIFF....WAVEfmt ....data...."  # dummy WAV header
        files = {
            "audio": ("test.wav", audio_data, "audio/wav")
        }
        form_data = {
            "session_id": str(self.session.id)
        }

        response = self.client.post(
            "/answers/submit-audio",
            files=files,
            data=form_data,
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["exchange_id"], str(self.exchange.id))
        self.assertIn("transcript", data)
        self.assertIn("speech_analysis", data)
        self.assertIn("avg_wpm", data["speech_analysis"])

    def test_submit_answer_no_active_question(self):
        # Create a new session with no questions
        import asyncio
        session_no_q = asyncio.run(create_test_session(self.db, self.user.id))

        response = self.client.post(
            "/answers/submit",
            json={
                "session_id": str(session_no_q.id),
                "answer_text": "Random answer",
            },
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("No pending question found", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
