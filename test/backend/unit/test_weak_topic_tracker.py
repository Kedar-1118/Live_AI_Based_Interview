import unittest
from test.backend.test_helpers import (
    init_test_db,
    clean_test_db,
    TestingSessionLocal,
    create_test_user,
)
from app.models.integrity import WeakTopic
from app.schemas.schemas import EvaluationResult
from app.services.weak_topic_tracker import (
    update_weak_topics,
    _extract_subtopic,
    get_user_weak_topics,
)


class TestWeakTopicTracker(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await init_test_db()
        self.db = TestingSessionLocal()
        self.user = await create_test_user(self.db)

    async def asyncTearDown(self):
        await self.db.close()
        await clean_test_db()

    async def test_update_weak_topics_high_score_skipped(self):
        eval_result = EvaluationResult(
            technical_accuracy=8,
            definition_present=True,
            mechanism_explained=True,
            example_given=True,
            edge_cases_mentioned=False,
            missing_concepts=["Advanced regularization"],
            incorrect_statements=[],
            follow_up_angle="Explain details",
            answer_summary="Good answer",
        )

        await update_weak_topics(self.user.id, "Machine Learning", eval_result, self.db)

        # Verify no weak topic was created
        weak_topics = await get_user_weak_topics(self.user.id, self.db)
        self.assertEqual(len(weak_topics), 0)

    async def test_update_weak_topics_low_score_recorded(self):
        eval_result = EvaluationResult(
            technical_accuracy=4,
            definition_present=True,
            mechanism_explained=False,
            example_given=False,
            edge_cases_mentioned=False,
            missing_concepts=["L1 Regularization"],
            incorrect_statements=[],
            follow_up_angle="L1 regularizer math",
            answer_summary="Incomplete answer",
        )

        await update_weak_topics(self.user.id, "Machine Learning", eval_result, self.db)

        weak_topics = await get_user_weak_topics(self.user.id, self.db)
        self.assertEqual(len(weak_topics), 1)
        self.assertEqual(weak_topics[0].topic, "Machine Learning")
        self.assertEqual(weak_topics[0].subtopic, "L1 Regularization")
        self.assertEqual(weak_topics[0].avg_score, 4.0)
        self.assertEqual(weak_topics[0].occurrence, 1)

    async def test_update_weak_topics_rolling_average(self):
        # First poor attempt
        eval1 = EvaluationResult(
            technical_accuracy=4,
            definition_present=True,
            mechanism_explained=False,
            example_given=False,
            edge_cases_mentioned=False,
            missing_concepts=["Clustering"],
            incorrect_statements=[],
            follow_up_angle="Probing clustering",
            answer_summary="Weak answer",
        )
        # Second poor attempt on same subtopic
        eval2 = EvaluationResult(
            technical_accuracy=6,
            definition_present=True,
            mechanism_explained=True,
            example_given=False,
            edge_cases_mentioned=False,
            missing_concepts=["Clustering"],
            incorrect_statements=[],
            follow_up_angle="Probing clustering",
            answer_summary="Moderate answer",
        )

        await update_weak_topics(self.user.id, "Machine Learning", eval1, self.db)
        await update_weak_topics(self.user.id, "Machine Learning", eval2, self.db)

        weak_topics = await get_user_weak_topics(self.user.id, self.db)
        self.assertEqual(len(weak_topics), 1)
        self.assertEqual(weak_topics[0].occurrence, 2)
        # (4.0 + 6.0) / 2 = 5.0
        self.assertEqual(weak_topics[0].avg_score, 5.0)

    def test_extract_subtopic(self):
        # Priority 1: missing_concepts
        eval_missing = EvaluationResult(
            technical_accuracy=5,
            definition_present=True,
            mechanism_explained=False,
            example_given=False,
            edge_cases_mentioned=False,
            missing_concepts=["ConceptA", "ConceptB"],
            incorrect_statements=[],
            follow_up_angle="Explain A",
            answer_summary="summary",
        )
        self.assertEqual(_extract_subtopic(eval_missing), "ConceptA")

        # Priority 2: follow_up_angle
        eval_follow_up = EvaluationResult(
            technical_accuracy=5,
            definition_present=True,
            mechanism_explained=False,
            example_given=False,
            edge_cases_mentioned=False,
            missing_concepts=[],
            incorrect_statements=[],
            follow_up_angle="Probe deeper into K-Means math",
            answer_summary="summary",
        )
        self.assertEqual(_extract_subtopic(eval_follow_up), "Probe deeper into K-Means math")

        # Priority 3: Weakest rubric dimension (definition missing)
        eval_rubric = EvaluationResult(
            technical_accuracy=5,
            definition_present=False,
            mechanism_explained=True,
            example_given=True,
            edge_cases_mentioned=True,
            missing_concepts=[],
            incorrect_statements=[],
            follow_up_angle="",
            answer_summary="summary",
        )
        self.assertEqual(_extract_subtopic(eval_rubric), "Core definitions")

        # Priority 4: General understanding fallback
        eval_fallback = EvaluationResult(
            technical_accuracy=5,
            definition_present=True,
            mechanism_explained=True,
            example_given=True,
            edge_cases_mentioned=True,
            missing_concepts=[],
            incorrect_statements=[],
            follow_up_angle="",
            answer_summary="summary",
        )
        self.assertEqual(_extract_subtopic(eval_fallback), "General understanding")


if __name__ == "__main__":
    unittest.main()
