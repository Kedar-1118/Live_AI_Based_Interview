"""
Speech analysis service using word-level timestamps from Whisper.
Computes WPM segments, detects pauses, counts filler words,
and produces a confidence proxy metric.
"""

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# Filler words / phrases to detect
FILLER_PATTERNS = [
    r"\bum+\b",
    r"\buh+\b",
    r"\bah+\b",
    r"\beh+\b",
    r"\bhmm+\b",
    r"\blike\b",
    r"\byou know\b",
    r"\bi mean\b",
    r"\bso+\b",           # only at sentence start — handled separately
    r"\bbasically\b",
    r"\bactually\b",
    r"\bkind of\b",
    r"\bsort of\b",
    r"\bwell\b",
]

# Compile into a single pattern for efficiency
FILLER_REGEX = re.compile(
    "|".join(FILLER_PATTERNS),
    re.IGNORECASE,
)


@dataclass
class PauseInfo:
    """Information about a detected pause in speech."""
    start: float          # timestamp where pause begins
    end: float            # timestamp where pause ends
    duration: float       # pause duration in seconds
    before_word: str      # word before the pause
    after_word: str       # word after the pause


@dataclass
class WPMSegment:
    """Words-per-minute measurement for a time window."""
    start: float          # window start time (seconds)
    end: float            # window end time (seconds)
    wpm: float            # words per minute in this window
    word_count: int       # number of words in this window


@dataclass
class SpeechAnalysis:
    """Complete speech analysis result."""
    avg_wpm: float = 0.0
    wpm_std_dev: float = 0.0
    wpm_segments: list[WPMSegment] = field(default_factory=list)
    total_duration: float = 0.0
    word_count: int = 0
    pause_count: int = 0
    longest_pause_seconds: float = 0.0
    pauses: list[PauseInfo] = field(default_factory=list)
    filler_count: int = 0
    filler_words: list[str] = field(default_factory=list)
    confidence_proxy: float = 0.0  # 0.0 - 1.0, higher = more confident


def calculate_wpm_segments(
    word_timestamps: list[dict],
    window_seconds: float = 10.0,
) -> list[WPMSegment]:
    """
    Calculate WPM in sliding windows from word-level timestamps.

    Uses a sliding window approach: for every 5th word, compute WPM
    within the next `window_seconds` window. This matches the spec's
    implementation from Feature 5.
    """
    if not word_timestamps or len(word_timestamps) < 2:
        return []

    segments = []
    words = word_timestamps

    for i in range(0, len(words), 5):
        window_start = words[i]["start"]
        window_end = window_start + window_seconds

        # Collect words in this window
        window_words = [
            w for w in words
            if window_start <= w["start"] < window_end
        ]

        if not window_words:
            continue

        # Calculate duration of speech in this window
        actual_start = window_words[0]["start"]
        actual_end = window_words[-1]["end"]
        duration = actual_end - actual_start

        if duration <= 0:
            continue

        wpm = (len(window_words) / duration) * 60

        segments.append(WPMSegment(
            start=round(actual_start, 3),
            end=round(actual_end, 3),
            wpm=round(wpm, 1),
            word_count=len(window_words),
        ))

    return segments


def detect_pauses(
    word_timestamps: list[dict],
    threshold_seconds: float = 2.0,
) -> list[PauseInfo]:
    """
    Detect pauses longer than threshold between consecutive words.

    Args:
        word_timestamps: List of {word, start, end} from Whisper
        threshold_seconds: Minimum gap to count as a pause

    Returns:
        List of PauseInfo objects for detected pauses
    """
    if not word_timestamps or len(word_timestamps) < 2:
        return []

    pauses = []

    for i in range(1, len(word_timestamps)):
        prev_end = word_timestamps[i - 1]["end"]
        curr_start = word_timestamps[i]["start"]
        gap = curr_start - prev_end

        if gap >= threshold_seconds:
            pauses.append(PauseInfo(
                start=round(prev_end, 3),
                end=round(curr_start, 3),
                duration=round(gap, 3),
                before_word=word_timestamps[i - 1]["word"],
                after_word=word_timestamps[i]["word"],
            ))

    return pauses


def count_fillers(transcript: str) -> tuple[int, list[str]]:
    """
    Count filler words/phrases in the transcript.

    Returns:
        Tuple of (total count, list of matched filler words)
    """
    if not transcript:
        return 0, []

    matches = FILLER_REGEX.findall(transcript)
    return len(matches), matches


def compute_confidence_proxy(
    avg_wpm: float,
    wpm_std_dev: float,
    filler_count: int,
    longest_pause: float,
    word_count: int,
) -> float:
    """
    Compute a confidence proxy score (0.0 - 1.0) based on speech characteristics.

    Higher score = more confident delivery:
    - Steady WPM (low std dev) → more confident
    - Fewer fillers → more confident
    - Shorter pauses → more confident
    - Reasonable speaking pace (120-180 WPM) → more confident
    """
    if word_count < 5:
        return 0.5  # not enough data

    score = 1.0

    # WPM consistency penalty (high variance = less confident)
    if avg_wpm > 0:
        cv = wpm_std_dev / avg_wpm  # coefficient of variation
        if cv > 0.5:
            score -= 0.2
        elif cv > 0.3:
            score -= 0.1

    # Filler word penalty
    filler_rate = filler_count / word_count
    if filler_rate > 0.1:
        score -= 0.3
    elif filler_rate > 0.05:
        score -= 0.15
    elif filler_rate > 0.02:
        score -= 0.05

    # Pause penalty
    if longest_pause > 10:
        score -= 0.2
    elif longest_pause > 5:
        score -= 0.1

    # Speaking pace — ideal is 120-180 WPM
    if avg_wpm < 80:
        score -= 0.15
    elif avg_wpm > 220:
        score -= 0.1

    return max(0.0, min(1.0, round(score, 2)))


def analyze_speech(
    word_timestamps: list[dict],
    transcript: str,
) -> SpeechAnalysis:
    """
    Run complete speech analysis on transcribed audio.

    Args:
        word_timestamps: Word-level timestamps from Whisper [{word, start, end}]
        transcript: Full transcript text

    Returns:
        SpeechAnalysis with all computed metrics
    """
    if not word_timestamps or not transcript:
        logger.warning("Empty input for speech analysis")
        return SpeechAnalysis()

    # Calculate WPM segments
    wpm_segments = calculate_wpm_segments(word_timestamps)

    # Overall WPM
    word_count = len(word_timestamps)
    total_duration = word_timestamps[-1]["end"] - word_timestamps[0]["start"]

    if total_duration > 0:
        avg_wpm = (word_count / total_duration) * 60
    else:
        avg_wpm = 0

    # WPM standard deviation
    if wpm_segments:
        wpm_values = [s.wpm for s in wpm_segments]
        mean_wpm = sum(wpm_values) / len(wpm_values)
        variance = sum((w - mean_wpm) ** 2 for w in wpm_values) / len(wpm_values)
        wpm_std_dev = variance ** 0.5
    else:
        wpm_std_dev = 0

    # Detect pauses
    pauses = detect_pauses(word_timestamps, threshold_seconds=2.0)
    longest_pause = max((p.duration for p in pauses), default=0.0)

    # Count fillers
    filler_count, filler_words = count_fillers(transcript)

    # Confidence proxy
    confidence = compute_confidence_proxy(
        avg_wpm=avg_wpm,
        wpm_std_dev=wpm_std_dev,
        filler_count=filler_count,
        longest_pause=longest_pause,
        word_count=word_count,
    )

    analysis = SpeechAnalysis(
        avg_wpm=round(avg_wpm, 1),
        wpm_std_dev=round(wpm_std_dev, 1),
        wpm_segments=wpm_segments,
        total_duration=round(total_duration, 2),
        word_count=word_count,
        pause_count=len(pauses),
        longest_pause_seconds=round(longest_pause, 2),
        pauses=pauses,
        filler_count=filler_count,
        filler_words=filler_words,
        confidence_proxy=confidence,
    )

    logger.info(
        f"Speech analysis complete: {word_count} words, {avg_wpm:.0f} WPM, "
        f"{filler_count} fillers, {len(pauses)} pauses, confidence={confidence:.2f}"
    )

    return analysis
