import {
  calculateWpmSegments,
  detectPauses,
  countFillers,
  computeConfidenceProxy,
  analyzeSpeech,
} from '../../src/services/speechAnalyzer';
import { WordTimestamp } from '../../src/services/transcriptionService';

describe('SpeechAnalyzer Unit Tests', () => {
  let wordTimestamps: WordTimestamp[];
  let transcript: string;

  beforeEach(() => {
    wordTimestamps = [
      { word: 'Hello', start: 0.0, end: 0.3 },
      { word: 'this', start: 0.4, end: 0.7 },
      { word: 'is', start: 0.8, end: 1.1 },
      { word: 'a', start: 1.2, end: 1.5 },
      { word: 'very', start: 1.6, end: 1.9 },
      { word: 'good', start: 2.0, end: 2.3 },
      { word: 'test', start: 2.4, end: 2.7 },
      { word: 'of', start: 2.8, end: 3.1 },
      { word: 'speech', start: 3.2, end: 3.5 },
      { word: 'analysis', start: 3.6, end: 4.0 },
    ];
    transcript = 'Hello this is a very good test of speech analysis';
  });

  test('calculateWpmSegments empty cases', () => {
    expect(calculateWpmSegments([])).toEqual([]);
    expect(calculateWpmSegments([{ word: 'one', start: 0.0, end: 1.0 }])).toEqual([]);
  });

  test('calculateWpmSegments basic flow', () => {
    const segments = calculateWpmSegments(wordTimestamps, 5.0);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].word_count).toBe(10);
    expect(segments[0].wpm).toBeGreaterThan(0);
  });

  test('detectPauses no pauses', () => {
    const pauses = detectPauses(wordTimestamps, 2.0);
    expect(pauses.length).toBe(0);
  });

  test('detectPauses with pause', () => {
    // Introduce a 3.3-second gap between word 4 and word 5
    const timestampsWithPause = [...wordTimestamps];
    timestampsWithPause[4] = { word: 'very', start: 4.9, end: 5.2 };
    
    // adjust subsequent words
    for (let idx = 5; idx < timestampsWithPause.length; idx++) {
      timestampsWithPause[idx] = {
        word: timestampsWithPause[idx].word,
        start: timestampsWithPause[idx].start + 3.3,
        end: timestampsWithPause[idx].end + 3.3,
      };
    }

    const pauses = detectPauses(timestampsWithPause, 2.0);
    expect(pauses.length).toBe(1);
    expect(pauses[0].duration).toBe(3.4);
  });

  test('countFillers basic count and list matches', () => {
    const transcriptWithFillers = 'Um like we should basically do this you know.';
    const { count, words } = countFillers(transcriptWithFillers);
    expect(count).toBe(4);
    expect(words).toContain('um');
    expect(words).toContain('like');
    expect(words).toContain('basically');
    expect(words).toContain('you know');
  });

  test('computeConfidenceProxy scenario checks', () => {
    // Excellent score scenario
    const scoreGood = computeConfidenceProxy(150, 10, 0, 0.5, 50);
    expect(scoreGood).toBe(1.0);

    // Poor score scenario (lots of fillers, long pauses)
    const scoreBad = computeConfidenceProxy(60, 35, 10, 12, 50);
    expect(scoreBad).toBeLessThan(0.5);
  });

  test('analyzeSpeech integrates all indicators', () => {
    const analysis = analyzeSpeech(wordTimestamps, transcript);
    expect(analysis.word_count).toBe(10);
    expect(analysis.filler_count).toBe(0);
    expect(analysis.pause_count).toBe(0);
    expect(analysis.avg_wpm).toBeGreaterThan(0);
    expect(analysis.confidence_proxy).toBeGreaterThan(0);
  });
});
