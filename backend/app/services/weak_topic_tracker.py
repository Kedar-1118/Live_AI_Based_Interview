"""
Week 3 — Weak Topic Tracker

Maintains a rolling record of topics/subtopics where the candidate
performs poorly across sessions. Used to:
  1. Inform the interviewer agent about persistent knowledge gaps
  2. Power the weak topic heatmap on the dashboard
"""

import logging
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integrity import WeakTopic
from app.schemas.schemas import EvaluationResult

logger = logging.getLogger(__name__)

# Score threshold below which a topic is considered "weak"
WEAK_SCORE_THRESHOLD = 7


async def update_weak_topics(
    user_id: UUID,
    topic: str,
    evaluation: EvaluationResult,
    db: AsyncSession,
) -> None:
    """
    Update the weak_topics table based on the latest evaluation.
    Called as a background task after answer evaluation.

    Logic:
    - If score ≤ threshold, extract subtopic from evaluation and upsert
    - Uses rolling average: new_avg = (old_avg * old_count + new_score) / (old_count + 1)
    - If topic+subtopic already exists, update avg and increment occurrence
    - If new, create a new record
    """
    try:
        score = evaluation.technical_accuracy

        if score > WEAK_SCORE_THRESHOLD:
            logger.debug(
                f"Score {score} above threshold {WEAK_SCORE_THRESHOLD} — skipping weak topic update"
            )
            return

        # Extract subtopic from evaluation
        subtopic = _extract_subtopic(evaluation)

        # Look for existing weak topic record
        result = await db.execute(
            select(WeakTopic).where(
                and_(
                    WeakTopic.user_id == user_id,
                    WeakTopic.topic == topic,
                    WeakTopic.subtopic == subtopic,
                )
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update rolling average
            old_avg = existing.avg_score or score
            old_count = existing.occurrence
            new_avg = (old_avg * old_count + score) / (old_count + 1)

            existing.avg_score = round(new_avg, 2)
            existing.occurrence = old_count + 1
            existing.last_seen = datetime.now(timezone.utc)

            logger.info(
                f"Updated weak topic: {topic}/{subtopic} — "
                f"avg_score: {existing.avg_score}, occurrences: {existing.occurrence}"
            )
        else:
            # Create new weak topic record
            weak_topic = WeakTopic(
                user_id=user_id,
                topic=topic,
                subtopic=subtopic,
                avg_score=float(score),
                occurrence=1,
            )
            db.add(weak_topic)

            logger.info(f"New weak topic recorded: {topic}/{subtopic} — score: {score}")

        await db.flush()

    except Exception as e:
        logger.error(f"Failed to update weak topics: {e}")


def _extract_subtopic(evaluation: EvaluationResult) -> str:
    """
    Extract a meaningful subtopic name from the evaluation result.
    Prioritizes missing_concepts, then follow_up_angle, then falls back
    to a dimension-based label.
    """
    # Use the first missing concept as the subtopic
    if evaluation.missing_concepts:
        # Take the first missing concept, truncate if too long
        subtopic = evaluation.missing_concepts[0]
        return subtopic[:100] if len(subtopic) > 100 else subtopic

    # Use follow-up angle if available
    if evaluation.follow_up_angle:
        angle = evaluation.follow_up_angle
        return angle[:100] if len(angle) > 100 else angle

    # Fall back to the weakest rubric dimension
    dimensions = {
        "Core definitions": not evaluation.definition_present,
        "Mechanism explanation": not evaluation.mechanism_explained,
        "Practical examples": not evaluation.example_given,
        "Edge case awareness": not evaluation.edge_cases_mentioned,
    }

    for dim_name, is_weak in dimensions.items():
        if is_weak:
            return dim_name

    return "General understanding"


async def get_user_weak_topics(
    user_id: UUID,
    db: AsyncSession,
    limit: int = 20,
) -> list[WeakTopic]:
    """
    Get all weak topics for a user, ordered by lowest avg_score (weakest first).
    """
    result = await db.execute(
        select(WeakTopic)
        .where(WeakTopic.user_id == user_id)
        .order_by(WeakTopic.avg_score.asc())
        .limit(limit)
    )
    return list(result.scalars().all())
