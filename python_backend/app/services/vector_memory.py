"""
Week 3 — Vector Memory Service

Provides embedding-based cross-session memory for the interviewer agent.
Stores Q&A pair embeddings and retrieves semantically similar weak answers
to inform adaptive follow-up question generation.

Uses OpenAI text-embedding-3-small (1536 dims) with a mock fallback
when OPENAI_API_KEY is not configured.

Storage: JSON-serialized float arrays in SQLite TEXT column.
In production with PostgreSQL + pgvector, swap to native vector column.
"""

import json
import logging
import numpy as np
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.exchange import Exchange
from app.models.session import Session
from app.models.integrity import Score

logger = logging.getLogger(__name__)
settings = get_settings()

EMBEDDING_DIM = 1536  # text-embedding-3-small output dimension


# ─── Embedding Generation ────────────────────────────────────

async def embed_text(text: str) -> list[float]:
    """
    Generate an embedding vector for the given text.
    Uses OpenAI text-embedding-3-small, with mock fallback.
    """
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "your-openai-api-key-here":
        logger.debug("No OpenAI API key — using mock embedding")
        return _mock_embedding(text)

    try:
        import openai

        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.embeddings.create(
            input=text,
            model="text-embedding-3-small",
        )
        return response.data[0].embedding

    except ImportError:
        logger.warning("openai package not installed — using mock embedding")
        return _mock_embedding(text)
    except Exception as e:
        logger.error(f"Embedding API error: {e} — using mock embedding")
        return _mock_embedding(text)


def _mock_embedding(text: str) -> list[float]:
    """
    Generate a deterministic mock embedding based on text content.
    Uses a seeded random generator so the same text always produces
    the same embedding — this makes retrieval functional in mock mode.
    """
    # Seed from text hash for deterministic output
    seed = hash(text) % (2**31)
    rng = np.random.RandomState(seed)
    vec = rng.randn(EMBEDDING_DIM).astype(float)
    # Normalize to unit vector (cosine similarity works best with unit vectors)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()


# ─── Store Exchange Embedding ─────────────────────────────────

async def embed_and_store_exchange(
    exchange_id: UUID,
    question: str,
    answer: str,
    db: AsyncSession,
) -> None:
    """
    Embed a Q&A pair and store the embedding on the exchange record.
    Called as a background task after answer evaluation.
    """
    try:
        content = f"Q: {question}\nA: {answer}"
        embedding = await embed_text(content)

        # Fetch the exchange and store the embedding as JSON
        result = await db.execute(
            select(Exchange).where(Exchange.id == exchange_id)
        )
        exchange = result.scalar_one_or_none()

        if exchange:
            exchange.embedding = json.dumps(embedding)
            await db.flush()
            logger.info(f"Stored embedding for exchange {exchange_id}")
        else:
            logger.warning(f"Exchange {exchange_id} not found for embedding storage")

    except Exception as e:
        logger.error(f"Failed to embed/store exchange {exchange_id}: {e}")


# ─── Retrieve Relevant Weak Answers ───────────────────────────

def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_np = np.array(a)
    b_np = np.array(b)
    dot = np.dot(a_np, b_np)
    norm_a = np.linalg.norm(a_np)
    norm_b = np.linalg.norm(b_np)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


async def retrieve_relevant_weak_answers(
    user_id: UUID,
    current_question: str,
    db: AsyncSession,
    top_k: int = 3,
    max_score_threshold: int = 7,
    match_threshold: float = 0.3,
) -> list[dict]:
    """
    Retrieve the most relevant prior weak answers for a given user.
    Used to provide cross-session context to the interviewer agent.

    Steps:
    1. Embed the current question
    2. Load all past exchanges with embeddings and scores ≤ threshold
    3. Compute cosine similarity
    4. Return top-k matches above match_threshold

    Note: match_threshold is set lower (0.3) for mock mode where
    embeddings are random-ish. In production with real embeddings,
    increase to 0.75.
    """
    try:
        query_embedding = await embed_text(current_question)

        # Load past exchanges with embeddings that had weak scores
        result = await db.execute(
            select(Exchange, Score, Session)
            .join(Score, Score.exchange_id == Exchange.id)
            .join(Session, Session.id == Exchange.session_id)
            .where(
                Session.user_id == user_id,
                Exchange.embedding.isnot(None),
                Exchange.answer_transcript.isnot(None),
                Score.technical_accuracy <= max_score_threshold,
            )
        )
        rows = result.all()

        if not rows:
            logger.debug("No past weak answers with embeddings found")
            return []

        # Compute similarities
        scored_results = []
        for exchange, score, session in rows:
            try:
                stored_embedding = json.loads(exchange.embedding)
                similarity = _cosine_similarity(query_embedding, stored_embedding)

                if similarity >= match_threshold:
                    scored_results.append({
                        "question": exchange.question,
                        "answer_transcript": exchange.answer_transcript,
                        "technical_accuracy": score.technical_accuracy,
                        "similarity": round(similarity, 4),
                        "topic": session.topic,
                        "follow_up_angle": score.follow_up_angle,
                    })
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(f"Skipping exchange {exchange.id}: invalid embedding: {e}")
                continue

        # Sort by similarity descending and take top-k
        scored_results.sort(key=lambda x: x["similarity"], reverse=True)
        top_results = scored_results[:top_k]

        if top_results:
            logger.info(
                f"Retrieved {len(top_results)} relevant weak answers "
                f"(best similarity: {top_results[0]['similarity']})"
            )
        else:
            logger.debug("No weak answers above similarity threshold")

        return top_results

    except Exception as e:
        logger.error(f"Failed to retrieve weak answers: {e}")
        return []


def format_retrieved_context(results: list[dict]) -> str:
    """
    Format retrieved weak answers into a context string
    for the interviewer agent prompt.
    """
    if not results:
        return ""

    lines = ["Prior weak answers from this candidate:"]
    for i, r in enumerate(results, 1):
        lines.append(
            f"\n{i}. Q: {r['question']}\n"
            f"   A: {r['answer_transcript'][:200]}{'...' if len(r.get('answer_transcript', '')) > 200 else ''}\n"
            f"   Score: {r['technical_accuracy']}/10 | "
            f"Suggested follow-up: {r.get('follow_up_angle', 'N/A')}"
        )

    return "\n".join(lines)
