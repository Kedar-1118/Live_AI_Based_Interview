from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.session import Session
from app.models.exchange import Exchange
from app.models.integrity import Score
from app.schemas.schemas import SessionCreate, SessionResponse, SessionSummary
from app.services.interviewer_agent import generate_first_question

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
