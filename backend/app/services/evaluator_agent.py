import json
import logging
from app.config import get_settings
from app.schemas.schemas import EvaluationResult

logger = logging.getLogger(__name__)
settings = get_settings()

EVALUATOR_SYSTEM_PROMPT = """You are a technical interview evaluator. Assess the following answer strictly and honestly.

Question: {question}
Topic: {topic}
Candidate's Answer: {transcript}

Return ONLY valid JSON. No preamble. No markdown. No explanation.

{{
  "technical_accuracy": <1-10>,
  "definition_present": <true|false>,
  "mechanism_explained": <true|false>,
  "example_given": <true|false>,
  "edge_cases_mentioned": <true|false>,
  "missing_concepts": ["concept1", "concept2"],
  "incorrect_statements": ["statement1"],
  "follow_up_angle": "<what specific aspect to probe next>",
  "answer_summary": "<one sentence summary of what was said>"
}}"""


async def evaluate_answer(
    question: str,
    transcript: str,
    topic: str,
    max_retries: int = 2,
) -> EvaluationResult:
    """
    Evaluate a candidate's answer using Claude claude-sonnet-4-20250514.
    Falls back to mock evaluation if API key is not configured.
    """
    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY == "your-anthropic-api-key-here":
        logger.info("No Anthropic API key configured — using mock evaluator")
        return _mock_evaluate(question, transcript, topic)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        prompt = EVALUATOR_SYSTEM_PROMPT.format(
            question=question,
            transcript=transcript,
            topic=topic,
        )

        for attempt in range(max_retries + 1):
            try:
                response = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=500,
                    messages=[{"role": "user", "content": prompt}],
                )

                raw = response.content[0].text.strip()

                # Try to extract JSON if wrapped in markdown code blocks
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                    raw = raw.strip()

                evaluation_data = json.loads(raw)
                return EvaluationResult(**evaluation_data)

            except (json.JSONDecodeError, Exception) as e:
                logger.warning(
                    f"Evaluator parse attempt {attempt + 1} failed: {e}"
                )
                if attempt == max_retries:
                    logger.error("All evaluator retries exhausted — using mock")
                    return _mock_evaluate(question, transcript, topic)

    except ImportError:
        logger.warning("anthropic package not installed — using mock evaluator")
        return _mock_evaluate(question, transcript, topic)
    except Exception as e:
        logger.error(f"Evaluator agent error: {e} — using mock")
        return _mock_evaluate(question, transcript, topic)


def _mock_evaluate(question: str, transcript: str, topic: str) -> EvaluationResult:
    """Generate a mock evaluation for testing without API access."""
    # Simple heuristic based on answer length
    word_count = len(transcript.split())

    if word_count > 100:
        accuracy = 7
    elif word_count > 50:
        accuracy = 5
    elif word_count > 20:
        accuracy = 4
    else:
        accuracy = 2

    return EvaluationResult(
        technical_accuracy=accuracy,
        definition_present=word_count > 30,
        mechanism_explained=word_count > 60,
        example_given="example" in transcript.lower() or "for instance" in transcript.lower(),
        edge_cases_mentioned="edge" in transcript.lower() or "corner" in transcript.lower(),
        missing_concepts=["Could elaborate more on core mechanisms"],
        incorrect_statements=[],
        follow_up_angle="Probe deeper into the underlying mechanism and real-world applications",
        answer_summary=f"Candidate provided a {'detailed' if word_count > 50 else 'brief'} answer about {topic}.",
    )
