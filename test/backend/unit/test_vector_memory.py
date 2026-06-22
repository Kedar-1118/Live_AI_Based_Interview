import unittest
import json
from test.backend.test_helpers import (
    init_test_db,
    clean_test_db,
    TestingSessionLocal,
    create_test_user,
    create_test_session,
)
from app.models.exchange import Exchange
from app.models.integrity import Score
from app.services.vector_memory import (
    embed_text,
    embed_and_store_exchange,
    retrieve_relevant_weak_answers,
    format_retrieved_context,
)


class TestVectorMemory(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await init_test_db()
        self.db = TestingSessionLocal()

    async def asyncTearDown(self):
        await self.db.close()
        await clean_test_db()

    async def test_embed_text_mock(self):
        text = "Difference between supervised and unsupervised learning"
        vec = await embed_text(text)

        self.assertEqual(len(vec), 1536)
        self.assertTrue(all(isinstance(x, float) for x in vec))

        # Check determinism of mock embedding
        vec2 = await embed_text(text)
        self.assertEqual(vec, vec2)

        # Check different texts have different embeddings
        vec_diff = await embed_text("Something completely different")
        self.assertNotEqual(vec, vec_diff)

    async def test_embed_and_store_exchange(self):
        user = await create_test_user(self.db)
        sess = await create_test_session(self.db, user.id)

        # Create exchange
        exchange = Exchange(
            session_id=sess.id,
            question="What is PCA?",
            question_index=0,
        )
        self.db.add(exchange)
        await self.db.commit()

        # Run embed and store
        await embed_and_store_exchange(
            exchange_id=exchange.id,
            question="What is PCA?",
            answer="Principal Component Analysis is a dimensionality reduction technique.",
            db=self.db,
        )

        # Retrieve exchange
        await self.db.refresh(exchange)
        self.assertIsNotNone(exchange.embedding)
        
        # Verify it decodes to 1536 values
        embedding_list = json.loads(exchange.embedding)
        self.assertEqual(len(embedding_list), 1536)

    async def test_retrieve_relevant_weak_answers(self):
        user = await create_test_user(self.db)
        sess = await create_test_session(self.db, user.id)

        # Create two exchanges with answers and weak scores
        ex1 = Exchange(
            session_id=sess.id,
            question="What is overfitting?",
            answer_transcript="It is when model is too complex.",
            question_index=0,
        )
        ex2 = Exchange(
            session_id=sess.id,
            question="What is linear regression?",
            answer_transcript="A linear model to predict value.",
            question_index=1,
        )
        self.db.add_all([ex1, ex2])
        await self.db.commit()

        # Add scores
        s1 = Score(exchange_id=ex1.id, technical_accuracy=4, follow_up_angle="Explain regularization")
        s2 = Score(exchange_id=ex2.id, technical_accuracy=5, follow_up_angle="Explain cost function")
        self.db.add_all([s1, s2])
        await self.db.commit()

        # Embed them
        await embed_and_store_exchange(ex1.id, ex1.question, ex1.answer_transcript, self.db)
        await embed_and_store_exchange(ex2.id, ex2.question, ex2.answer_transcript, self.db)

        # Retrieve matching the query
        results = await retrieve_relevant_weak_answers(
            user_id=user.id,
            current_question="Can you explain overfitting?",
            db=self.db,
            match_threshold=0.1,  # low threshold for mock
        )

        self.assertGreater(len(results), 0)
        # The best match should be overfitting since the query is closer
        self.assertEqual(results[0]["question"], "What is overfitting?")
        self.assertEqual(results[0]["technical_accuracy"], 4)

    def test_format_retrieved_context(self):
        results = [
            {
                "question": "What is overfitting?",
                "answer_transcript": "Too complex model.",
                "technical_accuracy": 4,
                "follow_up_angle": "Explain regularization",
            }
        ]
        context = format_retrieved_context(results)
        self.assertIn("Prior weak answers", context)
        self.assertIn("What is overfitting?", context)
        self.assertIn("Score: 4/10", context)
        self.assertIn("Explain regularization", context)

        # Test empty list
        self.assertEqual(format_retrieved_context([]), "")


if __name__ == "__main__":
    unittest.main()
 Pals
