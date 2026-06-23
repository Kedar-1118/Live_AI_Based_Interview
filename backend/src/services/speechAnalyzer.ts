import { WordTimestamp } from './transcriptionService';

export interface PauseInfo {
  start: number;
  end: number;
  duration: number;
  before_word: string;
  after_word: string;
}

export interface WPMSegment {
  start: number;
  end: number;
  wpm: number;
  word_count: number;
}

export interface SpeechAnalysis {
  avg_wpm: number;
  wpm_std_dev: number;
  wpm_segments: WPMSegment[];
  total_duration: number;
  word_count: number;
  pause_count: number;
  longest_pause_seconds: number;
  pauses: PauseInfo[];
  filler_count: number;
  filler_words: string[];
  confidence_proxy: number;
}

// Regex to capture filler words
const FILLER_REGEX = /\b(um+|uh+|ah+|eh+|hmm+|like|you know|i mean|so+|basically|actually|kind of|sort of|well)\b/gi;

export function calculateWpmSegments(
  wordTimestamps: WordTimestamp[],
  windowSeconds: number = 10.0
): WPMSegment[] {
  if (!wordTimestamps || wordTimestamps.length < 2) {
    return [];
  }

  const segments: WPMSegment[] = [];
  const words = wordTimestamps;

  for (let i = 0; i < words.length; i += 5) {
    const windowStart = words[i].start;
    const windowEnd = windowStart + windowSeconds;

    // Collect words within the window
    const windowWords = words.filter(w => w.start >= windowStart && w.start < windowEnd);

    if (windowWords.length === 0) {
      continue;
    }

    const actualStart = windowWords[0].start;
    const actualEnd = windowWords[windowWords.length - 1].end;
    const duration = actualEnd - actualStart;

    if (duration <= 0) {
      continue;
    }

    const wpm = (windowWords.length / duration) * 60;

    segments.push({
      start: Math.round(actualStart * 1000) / 1000,
      end: Math.round(actualEnd * 1000) / 1000,
      wpm: Math.round(wpm * 10) / 10,
      word_count: windowWords.length,
    });
  }

  return segments;
}

export function detectPauses(
  wordTimestamps: WordTimestamp[],
  thresholdSeconds: number = 2.0
): PauseInfo[] {
  if (!wordTimestamps || wordTimestamps.length < 2) {
    return [];
  }

  const pauses: PauseInfo[] = [];

  for (let i = 1; i < wordTimestamps.length; i++) {
    const prevEnd = wordTimestamps[i - 1].end;
    const currStart = wordTimestamps[i].start;
    const gap = currStart - prevEnd;

    if (gap >= thresholdSeconds) {
      pauses.push({
        start: Math.round(prevEnd * 1000) / 1000,
        end: Math.round(currStart * 1000) / 1000,
        duration: Math.round(gap * 1000) / 1000,
        before_word: wordTimestamps[i - 1].word,
        after_word: wordTimestamps[i].word,
      });
    }
  }

  return pauses;
}

export function countFillers(transcript: string): { count: number; words: string[] } {
  if (!transcript) {
    return { count: 0, words: [] };
  }

  const matches = transcript.match(FILLER_REGEX);
  if (!matches) {
    return { count: 0, words: [] };
  }

  return {
    count: matches.length,
    words: matches.map(w => w.toLowerCase()),
  };
}

export function computeConfidenceProxy(
  avgWpm: number,
  wpmStdDev: number,
  fillerCount: number,
  longestPause: number,
  wordCount: number
): number {
  if (wordCount < 5) {
    return 0.5; // not enough data
  }

  let score = 1.0;

  // WPM consistency penalty
  if (avgWpm > 0) {
    const cv = wpmStdDev / avgWpm; // coefficient of variation
    if (cv > 0.5) {
      score -= 0.2;
    } else if (cv > 0.3) {
      score -= 0.1;
    }
  }

  // Filler word penalty
  const fillerRate = fillerCount / wordCount;
  if (fillerRate > 0.1) {
    score -= 0.3;
  } else if (fillerRate > 0.05) {
    score -= 0.15;
  } else if (fillerRate > 0.02) {
    score -= 0.05;
  }

  // Pause penalty
  if (longestPause > 10.0) {
    score -= 0.2;
  } else if (longestPause > 5.0) {
    score -= 0.1;
  }

  // Speaking pace (ideal: 120-180 WPM)
  if (avgWpm < 80) {
    score -= 0.15;
  } else if (avgWpm > 220) {
    score -= 0.1;
  }

  return Math.max(0.0, Math.min(1.0, Math.round(score * 100) / 100));
}

export function analyzeSpeech(
  wordTimestamps: WordTimestamp[],
  transcript: string
): SpeechAnalysis {
  if (!wordTimestamps || wordTimestamps.length === 0 || !transcript) {
    console.warn('Empty input for speech analysis');
    return {
      avg_wpm: 0,
      wpm_std_dev: 0,
      wpm_segments: [],
      total_duration: 0,
      word_count: 0,
      pause_count: 0,
      longest_pause_seconds: 0,
      pauses: [],
      filler_count: 0,
      filler_words: [],
      confidence_proxy: 0.0,
    };
  }

  const wpm_segments = calculateWpmSegments(wordTimestamps);
  const word_count = wordTimestamps.length;
  const total_duration = wordTimestamps[wordTimestamps.length - 1].end - wordTimestamps[0].start;

  const avg_wpm = total_duration > 0 ? (word_count / total_duration) * 60 : 0;

  // WPM standard deviation calculation
  let wpm_std_dev = 0;
  if (wpm_segments.length > 0) {
    const wpmValues = wpm_segments.map(s => s.wpm);
    const meanWpm = wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length;
    const variance = wpmValues.reduce((sum, w) => sum + Math.pow(w - meanWpm, 2), 0) / wpmValues.length;
    wpm_std_dev = Math.sqrt(variance);
  }

  const pauses = detectPauses(wordTimestamps, 2.0);
  const longest_pause_seconds = pauses.reduce((max, p) => (p.duration > max ? p.duration : max), 0.0);

  const { count: filler_count, words: filler_words } = countFillers(transcript);

  const confidence_proxy = computeConfidenceProxy(
    avg_wpm,
    wpm_std_dev,
    filler_count,
    longest_pause_seconds,
    word_count
  );

  const analysis: SpeechAnalysis = {
    avg_wpm: Math.round(avg_wpm * 10) / 10,
    wpm_std_dev: Math.round(wpm_std_dev * 10) / 10,
    wpm_segments,
    total_duration: Math.round(total_duration * 100) / 100,
    word_count,
    pause_count: pauses.length,
    longest_pause_seconds: Math.round(longest_pause_seconds * 100) / 100,
    pauses,
    filler_count,
    filler_words,
    confidence_proxy,
  };

  console.log(
    `Speech analysis complete: ${word_count} words, ${analysis.avg_wpm} WPM, ` +
    `${filler_count} fillers, ${pauses.length} pauses, confidence=${confidence_proxy.toFixed(2)}`
  );

  return analysis;
}
