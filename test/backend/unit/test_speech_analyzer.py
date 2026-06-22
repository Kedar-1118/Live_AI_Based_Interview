import unittest
from app.services.speech_analyzer import (
    calculate_wpm_segments,
    detect_pauses,
    count_fillers,
    compute_confidence_proxy,
    analyze_speech,
)


class TestSpeechAnalyzer(unittest.TestCase):
    def setUp(self):
        # 10 words, spaced by 0.4s (ideal rate)
        self.word_timestamps = [
            {"word": "Hello", "start": 0.0, "end": 0.3},
            {"word": "this", "start": 0.4, "end": 0.7},
            {"word": "is", "start": 0.8, "end": 1.1},
            {"word": "a", "start": 1.2, "end": 1.5},
            {"word": "very", "start": 1.6, "end": 1.9},
            {"word": "good", "start": 2.0, "end": 2.3},
            {"word": "test", "start": 2.4, "end": 2.7},
            {"word": "of", "start": 2.8, "end": 3.1},
            {"word": "speech", "start": 3.2, "end": 3.5},
            {"word": "analysis", "start": 3.6, "end": 4.0},
        ]
        self.transcript = "Hello this is a very good test of speech analysis"

    def test_calculate_wpm_segments_empty(self):
        self.assertEqual(calculate_wpm_segments([]), [])
        self.assertEqual(calculate_wpm_segments([{"word": "one", "start": 0.0, "end": 1.0}]), [])

    def test_calculate_wpm_segments(self):
        segments = calculate_wpm_segments(self.word_timestamps, window_seconds=5.0)
        self.assertGreater(len(segments), 0)
        self.assertEqual(segments[0].word_count, 10)
        self.assertGreater(segments[0].wpm, 0)

    def test_detect_pauses_no_pause(self):
        pauses = detect_pauses(self.word_timestamps, threshold_seconds=2.0)
        self.assertEqual(len(pauses), 0)

    def test_detect_pauses_with_pause(self):
        # Introduce a 3-second gap between word 4 and word 5
        timestamps_with_pause = list(self.word_timestamps)
        timestamps_with_pause[4] = {"word": "very", "start": 4.9, "end": 5.2}
        # adjust subsequent words
        for idx in range(5, len(timestamps_with_pause)):
            timestamps_with_pause[idx] = {
                "word": timestamps_with_pause[idx]["word"],
                "start": timestamps_with_pause[idx]["start"] + 3.3,
                "end": timestamps_with_pause[idx]["end"] + 3.3,
            }

        pauses = detect_pauses(timestamps_with_pause, threshold_seconds=2.0)
        self.assertEqual(len(pauses), 1)
        self.assertEqual(pauses[0].duration, 3.4)

    def test_count_fillers(self):
        transcript_with_fillers = "Um like we should basically do this you know."
        count, fillers = count_fillers(transcript_with_fillers)
        self.assertEqual(count, 4)
        self.assertIn("Um", fillers)
        self.assertIn("like", fillers)
        self.assertIn("basically", fillers)
        self.assertIn("you know", fillers)

    def test_compute_confidence_proxy(self):
        # Excellent score scenario
        score_good = compute_confidence_proxy(
            avg_wpm=150,
            wpm_std_dev=10,
            filler_count=0,
            longest_pause=0.5,
            word_count=50,
        )
        self.assertEqual(score_good, 1.0)

        # Poor score scenario (lots of fillers, long pauses)
        score_bad = compute_confidence_proxy(
            avg_wpm=60,
            wpm_std_dev=35,
            filler_count=10,
            longest_pause=12,
            word_count=50,
        )
        self.assertLess(score_bad, 0.5)

    def test_analyze_speech(self):
        analysis = analyze_speech(self.word_timestamps, self.transcript)
        self.assertEqual(analysis.word_count, 10)
        self.assertEqual(analysis.filler_count, 0)
        self.assertEqual(analysis.pause_count, 0)
        self.assertGreater(analysis.avg_wpm, 0)
        self.assertGreater(analysis.confidence_proxy, 0)


if __name__ == "__main__":
    unittest.main()
