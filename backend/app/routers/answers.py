from uuid import UUID
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.session import Session
from app.models.exchange import Exchange
from app.models.integrity import Score
from app.schemas.schemas import (
    AnswerSubmit, AnswerProcessingResponse, EvaluationResult,
)
from app.services.evaluator_agent import evaluate_answer
from app.services.interviewer_agent import generate_next_question

router = APIRouter(prefix="/answers", tags=["Answers"])


@router.post("/submit", response_model=AnswerProcessingResponse)
async def submit_answer(
    request: AnswerSubmit,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a text answer for the current question.
    Runs evaluator agent → stores score → generates next question.
    """
    # Verify session belongs to user and is active
    result = await db.execute(
        select(Session).where(
            Session.id == request.session_id,
            Session.user_id == user.id,
        )
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
            detail="Session is not active",
        )

    # Find the current unanswered exchange
    result = await db.execute(
        select(Exchange)
        .where(
            Exchange.session_id == session.id,
            Exchange.answer_transcript.is_(None),
        )
        .order_by(Exchange.question_index)
        .limit(1)
    )
    current_exchange = result.scalar_one_or_none()

    if not current_exchange:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending question found",
        )

    # Store the answer transcript
    current_exchange.answer_transcript = request.answer_text
    await db.flush()

    # Run evaluator agent
    evaluation = await evaluate_answer(
        question=current_exchange.question,
        transcript=request.answer_text,
        topic=session.topic,
    )

    # Store the score
    score = Score(
        exchange_id=current_exchange.id,
        technical_accuracy=evaluation.technical_accuracy,
        definition_present=evaluation.definition_present,
        mechanism_explained=evaluation.mechanism_explained,
        example_given=evaluation.example_given,
        edge_cases_mentioned=evaluation.edge_cases_mentioned,
        missing_concepts=json.dumps(evaluation.missing_concepts) if evaluation.missing_concepts else None,
        follow_up_angle=evaluation.follow_up_angle,
    )
    db.add(score)
    await db.flush()

    # Check if session is complete
    next_index = current_exchange.question_index + 1
    session_complete = next_index > session.total_questions

    next_question_text = None

    if not session_complete:
        # Build performance summary from all scored exchanges
        all_exchanges_result = await db.execute(
            select(Exchange)
            .where(Exchange.session_id == session.id)
            .order_by(Exchange.question_index)
        )
        all_exchanges = all_exchanges_result.scalars().all()

        scores_list = []
        for ex in all_exchanges:
            if ex.score and ex.score.technical_accuracy is not None:
                scores_list.append(ex.score.technical_accuracy)

        avg_score = sum(scores_list) / len(scores_list) if scores_list else 0
        performance_summary = (
            f"Questions answered: {len(scores_list)}/{session.total_questions}. "
            f"Average score: {avg_score:.1f}/10."
        )

        # Generate next question
        next_question_text = await generate_next_question(
            topic=session.topic,
            difficulty=session.difficulty,
            evaluation=evaluation,
            question_index=next_index,
            total_questions=session.total_questions,
            performance_summary=performance_summary,
        )

        # Create next exchange
        next_exchange = Exchange(
            session_id=session.id,
            question=next_question_text,
            question_index=next_index,
        )
        db.add(next_exchange)
        await db.flush()
    else:
        # Mark session as completed
        from datetime import datetime, timezone
        session.status = "completed"
        session.ended_at = datetime.now(timezone.utc)
        await db.flush()

    return AnswerProcessingResponse(
        exchange_id=current_exchange.id,
        evaluation=evaluation,
        next_question=next_question_text,
        question_index=current_exchange.question_index,
        session_complete=session_complete,
    )
