from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.session import Session
from app.models.exchange import Exchange
from app.models.integrity import Score
from app.schemas.schemas import DashboardResponse, SessionSummary, UserResponse, WeakTopicResponse
from app.services.weak_topic_tracker import get_user_weak_topics

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse.model_validate(user)


@router.get("/me/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's dashboard with aggregate stats and recent sessions."""
    # Get all sessions for this user
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user.id)
        .order_by(Session.started_at.desc())
    )
    sessions = result.scalars().all()

    total_sessions = len(sessions)
    completed_sessions = sum(1 for s in sessions if s.status == "completed")

    # Build session summaries
    session_summaries = []
    all_scores = []

    for session in sessions:
        questions_answered = 0
        session_scores = []

        for exchange in session.exchanges:
            if exchange.answer_transcript is not None:
                questions_answered += 1
                if exchange.score and exchange.score.technical_accuracy is not None:
                    session_scores.append(exchange.score.technical_accuracy)
                    all_scores.append(exchange.score.technical_accuracy)

        avg_session_score = (
            sum(session_scores) / len(session_scores)
            if session_scores
            else None
        )

        session_summaries.append(SessionSummary(
            id=session.id,
            topic=session.topic,
            difficulty=session.difficulty,
            status=session.status,
            integrity_score=session.integrity_score,
            total_questions=session.total_questions,
            questions_answered=questions_answered,
            avg_score=avg_session_score,
            started_at=session.started_at,
            ended_at=session.ended_at,
        ))

    total_questions_answered = sum(s.questions_answered for s in session_summaries)
    overall_avg = sum(all_scores) / len(all_scores) if all_scores else None

    return DashboardResponse(
        total_sessions=total_sessions,
        completed_sessions=completed_sessions,
        avg_score=overall_avg,
        total_questions_answered=total_questions_answered,
        recent_sessions=session_summaries[:10],
    )


@router.get("/me/sessions", response_model=list[SessionSummary])
async def get_my_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all sessions for the current user."""
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user.id)
        .order_by(Session.started_at.desc())
    )
    sessions = result.scalars().all()

    summaries = []
    for session in sessions:
        questions_answered = 0
        session_scores = []

        for exchange in session.exchanges:
            if exchange.answer_transcript is not None:
                questions_answered += 1
                if exchange.score and exchange.score.technical_accuracy is not None:
                    session_scores.append(exchange.score.technical_accuracy)

        avg_score = (
            sum(session_scores) / len(session_scores)
            if session_scores
            else None
        )

        summaries.append(SessionSummary(
            id=session.id,
            topic=session.topic,
            difficulty=session.difficulty,
            status=session.status,
            integrity_score=session.integrity_score,
            total_questions=session.total_questions,
            questions_answered=questions_answered,
            avg_score=avg_score,
            started_at=session.started_at,
            ended_at=session.ended_at,
        ))

    return summaries


@router.get("/me/weak-topics", response_model=list[WeakTopicResponse])
async def get_weak_topics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's weak topics, ordered by lowest score."""
    topics = await get_user_weak_topics(user_id=user.id, db=db)
    return [WeakTopicResponse.model_validate(t) for t in topics]
