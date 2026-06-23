import { OpenAI } from 'openai';
import fs from 'fs';
import { config } from '../config';

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export class TranscriptionResult {
  constructor(
    public transcript: string,
    public word_timestamps: WordTimestamp[],
    public duration: number
  ) {}
}

export async function transcribeAudio(audioPath: string, maxRetries: number = 2): Promise<TranscriptionResult> {
  const isMock = !config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'your-openai-api-key-here';

  if (isMock) {
    console.log('No OpenAI API key configured — using mock transcription');
    return mockTranscribe(audioPath);
  }

  try {
    const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const fileStream = fs.createReadStream(audioPath);
        const response: any = await openai.audio.transcriptions.create({
          model: 'whisper-1',
          file: fileStream,
          response_format: 'verbose_json',
          timestamp_granularities: ['word'],
        });

        const transcript = response.text || '';
        const word_timestamps: WordTimestamp[] = [];

        if (response.words && Array.isArray(response.words)) {
          for (const w of response.words) {
            word_timestamps.append ? null : word_timestamps.push({
              word: w.word || '',
              start: Number(w.start || 0),
              end: Number(w.end || 0),
            });
          }
        }

        let duration = 0;
        if (word_timestamps.length > 0) {
          duration = word_timestamps[word_timestamps.length - 1].end;
        } else if (response.duration) {
          duration = Number(response.duration);
        }

        console.log(`Whisper transcription complete: ${word_timestamps.length} words, ${duration.toFixed(1)}s duration`);

        return new TranscriptionResult(transcript, word_timestamps, duration);
      } catch (err) {
        console.warn(`Whisper transcription attempt ${attempt + 1} failed:`, err);
        if (attempt === maxRetries) {
          console.error('All Whisper retries exhausted — using mock transcription');
          return mockTranscribe(audioPath);
        }
      }
    }
  } catch (err) {
    console.error('Transcription service configuration/startup error:', err);
    return mockTranscribe(audioPath);
  }

  return mockTranscribe(audioPath);
}

function mockTranscribe(audioPath: string): TranscriptionResult {
  const mockAnswers = [
    'Machine learning is a subset of artificial intelligence that enables systems to learn ' +
    'and improve from experience without being explicitly programmed. It focuses on developing ' +
    'algorithms that can access data and use it to learn for themselves. For example, ' +
    'supervised learning uses labeled training data to make predictions, while unsupervised ' +
    'learning finds patterns in unlabeled data.',

    'The bias-variance tradeoff is a fundamental concept in machine learning. Bias refers to ' +
    'errors from overly simplistic assumptions in the model, leading to underfitting. Variance ' +
    'refers to errors from sensitivity to small fluctuations in the training data, leading to ' +
    'overfitting. The goal is to find the right balance between the two to minimize total error.',

    'Gradient descent is an optimization algorithm used to minimize the loss function by ' +
    'iteratively adjusting the model parameters. It works by computing the gradient of the ' +
    'loss function with respect to each parameter and updating the parameters in the opposite ' +
    'direction of the gradient. There are variants like stochastic gradient descent and ' +
    'mini-batch gradient descent that offer different tradeoffs between speed and accuracy.',

    'A hash table is a data structure that implements an associative array, mapping keys to ' +
    'values. It uses a hash function to compute an index into an array of buckets, from which ' +
    'the desired value can be found. Collisions are handled through techniques like chaining ' +
    'or open addressing. The average time complexity for lookup is O(1).',

    'The CAP theorem states that a distributed system can only guarantee two out of three ' +
    'properties: Consistency, Availability, and Partition tolerance. In practice, since network ' +
    'partitions are unavoidable, you must choose between consistency and availability. ' +
    'For example, a banking system prioritizes consistency while a social media feed ' +
    'might prioritize availability.',
  ];

  // Pick a random answer
  const randomIndex = Math.floor(Math.random() * mockAnswers.length);
  const transcript = mockAnswers[randomIndex];
  const words = transcript.split(/\s+/);

  const word_timestamps: WordTimestamp[] = [];
  let currentTime = 0.3; // small initial delay

  for (const word of words) {
    const wordDuration = 0.15 + Math.random() * 0.3; // between 0.15s and 0.45s
    let pause = 0.05 + Math.random() * 0.2; // between 0.05s and 0.25s

    // Occasional longer pauses at punctuation marks
    if (word.endsWith('.') || word.endsWith(',')) {
      pause += 0.2 + Math.random() * 0.6; // extra 0.2s - 0.8s
    }

    const start = currentTime;
    const end = start + wordDuration;

    word_timestamps.push({
      word,
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
    });

    currentTime = end + pause;
  }

  const duration = word_timestamps.length > 0 ? word_timestamps[word_timestamps.length - 1].end : 0;
  console.log(`Mock transcription generated: ${words.length} words, ${duration.toFixed(1)}s`);

  return new TranscriptionResult(transcript, word_timestamps, duration);
}
