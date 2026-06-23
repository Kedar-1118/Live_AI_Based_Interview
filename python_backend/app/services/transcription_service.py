"""
Whisper-based audio transcription service.
Uses OpenAI's Whisper API for speech-to-text with word-level timestamps.
Falls back to mock transcription when API key is not configured.
"""

import logging
import os
import random
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class TranscriptionResult:
    """Result of audio transcription."""

    def __init__(self, transcript: str, word_timestamps: list[dict], duration: float):
        self.transcript = transcript
        self.word_timestamps = word_timestamps  # [{word, start, end}]
        self.duration = duration  # total duration in seconds


async def transcribe_audio(audio_path: str, max_retries: int = 2) -> TranscriptionResult:
    """
    Transcribe audio file using OpenAI Whisper API.
    Falls back to mock transcription if API key is not configured.

    Args:
        audio_path: Path to the audio file
        max_retries: Number of retries on failure

    Returns:
        TranscriptionResult with transcript text and word-level timestamps
    """
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "your-openai-api-key-here":
        logger.info("No OpenAI API key configured — using mock transcription")
        return _mock_transcribe(audio_path)

    try:
        import openai

        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

        for attempt in range(max_retries + 1):
            try:
                with open(audio_path, "rb") as f:
                    response = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=f,
                        response_format="verbose_json",
                        timestamp_granularities=["word"],
                    )

                transcript = response.text
                word_timestamps = []

                # Extract word-level timestamps
                if hasattr(response, "words") and response.words:
                    for w in response.words:
                        word_timestamps.append({
                            "word": w.word if hasattr(w, "word") else w.get("word", ""),
                            "start": w.start if hasattr(w, "start") else w.get("start", 0),
                            "end": w.end if hasattr(w, "end") else w.get("end", 0),
                        })

                # Calculate duration from timestamps or response
                duration = 0.0
                if word_timestamps:
                    duration = word_timestamps[-1]["end"]
                elif hasattr(response, "duration"):
                    duration = response.duration

                logger.info(
                    f"Whisper transcription complete: {len(word_timestamps)} words, "
                    f"{duration:.1f}s duration"
                )

                return TranscriptionResult(
                    transcript=transcript,
                    word_timestamps=word_timestamps,
                    duration=duration,
                )

            except Exception as e:
                logger.warning(
                    f"Whisper transcription attempt {attempt + 1} failed: {e}"
                )
                if attempt == max_retries:
                    logger.error("All Whisper retries exhausted — using mock transcription")
                    return _mock_transcribe(audio_path)

    except ImportError:
        logger.warning("openai package not installed — using mock transcription")
        return _mock_transcribe(audio_path)
    except Exception as e:
        logger.error(f"Transcription error: {e} — using mock transcription")
        return _mock_transcribe(audio_path)


def _mock_transcribe(audio_path: str) -> TranscriptionResult:
    """
    Generate a mock transcription for testing without API access.
    Produces realistic-looking word timestamps.
    """
    mock_answers = [
        "Machine learning is a subset of artificial intelligence that enables systems to learn "
        "and improve from experience without being explicitly programmed. It focuses on developing "
        "algorithms that can access data and use it to learn for themselves. For example, "
        "supervised learning uses labeled training data to make predictions, while unsupervised "
        "learning finds patterns in unlabeled data.",

        "The bias-variance tradeoff is a fundamental concept in machine learning. Bias refers to "
        "errors from overly simplistic assumptions in the model, leading to underfitting. Variance "
        "refers to errors from sensitivity to small fluctuations in the training data, leading to "
        "overfitting. The goal is to find the right balance between the two to minimize total error.",

        "Gradient descent is an optimization algorithm used to minimize the loss function by "
        "iteratively adjusting the model parameters. It works by computing the gradient of the "
        "loss function with respect to each parameter and updating the parameters in the opposite "
        "direction of the gradient. There are variants like stochastic gradient descent and "
        "mini-batch gradient descent that offer different tradeoffs between speed and accuracy.",

        "A hash table is a data structure that implements an associative array, mapping keys to "
        "values. It uses a hash function to compute an index into an array of buckets, from which "
        "the desired value can be found. Collisions are handled through techniques like chaining "
        "or open addressing. The average time complexity for lookup is O(1).",

        "The CAP theorem states that a distributed system can only guarantee two out of three "
        "properties: Consistency, Availability, and Partition tolerance. In practice, since network "
        "partitions are unavoidable, you must choose between consistency and availability. "
        "For example, a banking system prioritizes consistency while a social media feed "
        "might prioritize availability.",
    ]

    transcript = random.choice(mock_answers)
    words = transcript.split()

    # Generate realistic word timestamps
    # Average speaking rate: ~150 WPM = ~0.4s per word with natural variation
    word_timestamps = []
    current_time = 0.3  # small initial delay

    for word in words:
        word_duration = random.uniform(0.15, 0.45)
        pause = random.uniform(0.05, 0.25)

        # Occasional longer pauses (between sentences)
        if word.endswith((".")) or word.endswith((",")) :
            pause += random.uniform(0.2, 0.8)

        start = current_time
        end = start + word_duration

        word_timestamps.append({
            "word": word,
            "start": round(start, 3),
            "end": round(end, 3),
        })

        current_time = end + pause

    duration = word_timestamps[-1]["end"] if word_timestamps else 0

    logger.info(f"Mock transcription generated: {len(words)} words, {duration:.1f}s")

    return TranscriptionResult(
        transcript=transcript,
        word_timestamps=word_timestamps,
        duration=duration,
    )
