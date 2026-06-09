import asyncio
import json
import logging
import os
import uuid as uuid_module
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.session import Session
from app.models.exchange import Exchange
from app.models.integrity import Score
from app.schemas.schemas import (
    AnswerSubmit, AnswerProcessingResponse, EvaluationResult,
    AudioAnswerProcessingResponse, SpeechAnalysisResponse,
)
from app.services.evaluator_agent import evaluate_answer
from app.services.interviewer_agent import generate_next_question
from app.services.transcription_service import transcribe_audio
from app.services.vector_memory import (
    embed_and_store_exchange,
    retrieve_relevant_weak_answers,
    format_retrieved_context,
)
from app.services.weak_topic_tracker import update_weak_topics
from app.services.speech_analyzer import analyze_speech

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/answers", tags=["Answers"])


# ─── Helper: common answer processing logic ──────────────────

async def _process_evaluation_and_next_question(
    session: Session,
    current_exchange: Exchange,
    transcript: str,
    db: AsyncSession,
) -> tuple[EvaluationResult, str | None, bool]:
    """
    Run evaluator on transcript, store score, generate next question.
    Returns (evaluation, next_question_text, session_complete).
    """
    # Run evaluator agent
    evaluation = await evaluate_answer(
        question=current_exchange.question,
        transcript=transcript,
        topic=session.topic,
    )

    # Store the score (speech metrics will be added by the caller if available)
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

    # ─── Week 3: Embed exchange + update weak topics (non-blocking) ───
    try:
        await embed_and_store_exchange(
            exchange_id=current_exchange.id,
            question=current_exchange.question,
            answer=transcript,
            db=db,
        )
    except Exception as e:
        logger.warning(f"Embedding storage failed (non-critical): {e}")

    try:
        await update_weak_topics(
            user_id=session.user_id,
            topic=session.topic,
            evaluation=evaluation,
            db=db,
        )
    except Exception as e:
        logger.warning(f"Weak topic update failed (non-critical): {e}")

    # Check if session is complete
    next_index = current_exchange.question_index + 1
    session_complete = next_index > session.total_questions

    next_question_text = None

    if not session_complete:
        # Build performance summary
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

        # ─── Week 3: Retrieve cross-session memory context ────────
        retrieved_context = ""
        try:
            weak_answers = await retrieve_relevant_weak_answers(
                user_id=session.user_id,
                current_question=current_exchange.question,
                db=db,
            )
            retrieved_context = format_retrieved_context(weak_answers)
            if retrieved_context:
                logger.info(f"Injecting {len(weak_answers)} retrieved weak answers into interviewer context")
        except Exception as e:
            logger.warning(f"Memory retrieval failed (non-critical): {e}")

        # Generate next question (with memory context)
        next_question_text = await generate_next_question(
            topic=session.topic,
            difficulty=session.difficulty,
            evaluation=evaluation,
            question_index=next_index,
            total_questions=session.total_questions,
            performance_summary=performance_summary,
            retrieved_context=retrieved_context,
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

    return evaluation, next_question_text, session_complete


async def _get_active_exchange(session: Session, db: AsyncSession) -> Exchange:
    """Get the current unanswered exchange for a session."""
    result = await db.execute(
        select(Exchange)
        .where(
            Exchange.session_id == session.id,
            Exchange.answer_transcript.is_(None),
        )
        .order_by(Exchange.question_index)
        .limit(1)
    )
    exchange = result.scalar_one_or_none()

    if not exchange:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending question found",
        )

    return exchange


async def _validate_session(session_id: UUID, user: User, db: AsyncSession) -> Session:
    """Verify session belongs to user and is active."""
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
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

    return session


# ─── Endpoint: Text Answer (Week 1 — preserved) ──────────────

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
    session = await _validate_session(request.session_id, user, db)
    current_exchange = await _get_active_exchange(session, db)

    # Store the answer transcript
    current_exchange.answer_transcript = request.answer_text
    await db.flush()

    # Process evaluation and next question
    evaluation, next_question_text, session_complete = (
        await _process_evaluation_and_next_question(
            session, current_exchange, request.answer_text, db
        )
    )

    return AnswerProcessingResponse(
        exchange_id=current_exchange.id,
        evaluation=evaluation,
        next_question=next_question_text,
        question_index=current_exchange.question_index,
        session_complete=session_complete,
    )


# ─── Endpoint: Audio Answer (Week 2 — Voice Pipeline) ────────

@router.post("/submit-audio", response_model=AudioAnswerProcessingResponse)
async def submit_audio_answer(
    audio: UploadFile = File(..., description="Audio recording of the answer"),
    session_id: str = Form(..., description="Session UUID"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit an audio answer for the current question.
    Runs parallel pipeline:
      1. Whisper API → transcript + word timestamps
      2. Speech analysis → WPM, pauses, fillers
      3. (Placeholder) Speaker verification
    Then sequential:
      4. Evaluator agent on transcript → structured score
      5. Generate next question
    """
    # Parse and validate session_id
    try:
        parsed_session_id = UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session_id format",
        )

    session = await _validate_session(parsed_session_id, user, db)
    current_exchange = await _get_active_exchange(session, db)

    # Validate audio file
    if not audio.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio file provided",
        )

    # Check file size
    content = await audio.read()
    max_size = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio file too large. Maximum: {settings.MAX_AUDIO_SIZE_MB}MB",
        )

    # Save audio to local filesystem
    audio_dir = os.path.join(settings.UPLOAD_DIR, "audio", str(parsed_session_id))
    os.makedirs(audio_dir, exist_ok=True)

    # Determine file extension from content type or filename
    ext = ".webm"
    if audio.content_type:
        content_type_map = {
            "audio/webm": ".webm",
            "audio/ogg": ".ogg",
            "audio/wav": ".wav",
            "audio/mp4": ".mp4",
            "audio/mpeg": ".mp3",
        }
        ext = content_type_map.get(audio.content_type, ".webm")
    elif audio.filename and "." in audio.filename:
        ext = "." + audio.filename.rsplit(".", 1)[1]

    audio_filename = f"{current_exchange.id}{ext}"
    audio_path = os.path.join(audio_dir, audio_filename)

    with open(audio_path, "wb") as f:
        f.write(content)

    logger.info(
        f"Audio saved: {audio_path} ({len(content)} bytes, {audio.content_type})"
    )

    # ─── Parallel Processing Pipeline ─────────────────────────
    # Run transcription and (future) speaker verification in parallel.
    # Speech analysis depends on transcription output, so it runs after.

    transcription_result = await transcribe_audio(audio_path)

    # Run speech analysis on the transcription result
    speech_analysis = analyze_speech(
        word_timestamps=transcription_result.word_timestamps,
        transcript=transcription_result.transcript,
    )

    # Store the answer transcript
    current_exchange.answer_transcript = transcription_result.transcript
    await db.flush()

    # ─── Sequential: Evaluation + Next Question ───────────────

    evaluation, next_question_text, session_complete = (
        await _process_evaluation_and_next_question(
            session, current_exchange, transcription_result.transcript, db
        )
    )

    # Update the score with speech metrics
    score_result = await db.execute(
        select(Score).where(Score.exchange_id == current_exchange.id)
    )
    score = score_result.scalar_one_or_none()
    if score:
        score.wpm = int(speech_analysis.avg_wpm)
        score.filler_count = speech_analysis.filler_count
        score.longest_pause_seconds = speech_analysis.longest_pause_seconds
        score.confidence_proxy = speech_analysis.confidence_proxy
        await db.flush()

    # Build speech analysis response
    speech_response = SpeechAnalysisResponse(
        avg_wpm=speech_analysis.avg_wpm,
        wpm_std_dev=speech_analysis.wpm_std_dev,
        total_duration=speech_analysis.total_duration,
        word_count=speech_analysis.word_count,
        pause_count=speech_analysis.pause_count,
        longest_pause_seconds=speech_analysis.longest_pause_seconds,
        filler_count=speech_analysis.filler_count,
        filler_words=speech_analysis.filler_words,
        confidence_proxy=speech_analysis.confidence_proxy,
    )

    return AudioAnswerProcessingResponse(
        exchange_id=current_exchange.id,
        transcript=transcription_result.transcript,
        evaluation=evaluation,
        speech_analysis=speech_response,
        next_question=next_question_text,
        question_index=current_exchange.question_index,
        session_complete=session_complete,
    )
