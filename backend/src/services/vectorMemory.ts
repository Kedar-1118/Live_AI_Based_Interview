import { OpenAI } from 'openai';
import { getDb } from '../db';
import { checkAndGetApiKey } from './aiProvider';

const EMBEDDING_DIM = 1536;

export async function embedText(text: string, user: any): Promise<number[]> {
  let apiKey = '';
  try {
    apiKey = await checkAndGetApiKey(user.id, 'openai', user);
  } catch (err: any) {
    console.error('Failed to authenticate embedding key:', err);
    if (err.status === 402) {
      throw err;
    }
    return mockEmbedding(text);
  }

  const isMock = apiKey === 'mock';

  if (isMock) {
    return mockEmbedding(text);
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.embeddings.create({
      input: text,
      model: 'text-embedding-3-small',
    });

    return response.data[0].embedding;
  } catch (err) {
    console.error('Error generating OpenAI embedding:', err);
    return mockEmbedding(text);
  }
}

// Seedable PRNG (Mulberry32)
function seedRandom(seedStr: string) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return function () {
    let t = (h += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic mock embedding based on input text
function mockEmbedding(text: string): number[] {
  const rand = seedRandom(text);
  const vec: number[] = [];

  for (let i = 0; i < EMBEDDING_DIM; i += 2) {
    let u1 = rand();
    let u2 = rand();
    if (u1 === 0) u1 = 0.0001; // Avoid log(0)

    const r = Math.sqrt(-2.0 * Math.log(u1));
    const theta = 2.0 * Math.PI * u2;

    const z0 = r * Math.cos(theta);
    const z1 = r * Math.sin(theta);

    vec.push(z0);
    if (vec.length < EMBEDDING_DIM) {
      vec.push(z1);
    }
  }

  // Normalize to unit vector
  let sumSq = 0;
  for (const val of vec) {
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm;
    }
  }

  return vec;
}

export async function embedAndStoreExchange(
  exchangeId: string,
  question: string,
  answer: string,
  user: any
): Promise<void> {
  try {
    const content = `Q: ${question}\nA: ${answer}`;
    const embedding = await embedText(content, user);

    const db = getDb();
    await db.run(
      'UPDATE exchanges SET embedding = ? WHERE id = ?',
      [JSON.stringify(embedding), exchangeId]
    );

    console.log(`Stored embedding for exchange ${exchangeId}`);
  } catch (err) {
    console.error(`Failed to embed/store exchange ${exchangeId}:`, err);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0.0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RetrievedWeakAnswer {
  question: string;
  answer_transcript: string;
  technical_accuracy: number;
  similarity: number;
  topic: string;
  follow_up_angle: string;
}

export async function retrieveRelevantWeakAnswers(
  userId: string,
  currentQuestion: string,
  user: any,
  topK: number = 3,
  maxScoreThreshold: number = 7,
  matchThreshold: number = 0.3
): Promise<RetrievedWeakAnswer[]> {
  try {
    const queryEmbedding = await embedText(currentQuestion, user);
    const db = getDb();

    // Load past exchanges with embeddings that had weak scores
    const rows = await db.all(`
      SELECT 
        e.id, e.question, e.answer_transcript, e.embedding, 
        s.technical_accuracy, s.follow_up_angle,
        sess.topic
      FROM exchanges e
      JOIN scores s ON s.exchange_id = e.id
      JOIN sessions sess ON sess.id = e.session_id
      WHERE 
        sess.user_id = ?
        AND e.embedding IS NOT NULL
        AND e.answer_transcript IS NOT NULL
        AND s.technical_accuracy <= ?
    `, [userId, maxScoreThreshold]);

    if (!rows || rows.length === 0) {
      console.log('No past weak answers with embeddings found');
      return [];
    }

    const scoredResults: RetrievedWeakAnswer[] = [];

    for (const row of rows) {
      try {
        const storedEmbedding = JSON.parse(row.embedding);
        if (!Array.isArray(storedEmbedding)) {
          continue;
        }

        const similarity = cosineSimilarity(queryEmbedding, storedEmbedding);
        if (similarity >= matchThreshold) {
          scoredResults.push({
            question: row.question,
            answer_transcript: row.answer_transcript,
            technical_accuracy: row.technical_accuracy,
            similarity: Math.round(similarity * 10000) / 10000,
            topic: row.topic,
            follow_up_angle: row.follow_up_angle || '',
          });
        }
      } catch (err) {
        console.warn(`Skipping exchange ${row.id}: invalid embedding JSON`, err);
      }
    }

    // Sort descending by similarity
    scoredResults.sort((a, b) => b.similarity - a.similarity);
    const topResults = scoredResults.slice(0, topK);

    if (topResults.length > 0) {
      console.log(
        `Retrieved ${topResults.length} relevant weak answers ` +
        `(best similarity: ${topResults[0].similarity})`
      );
    } else {
      console.log('No weak answers above similarity threshold');
    }

    return topResults;
  } catch (err) {
    console.error('Failed to retrieve weak answers:', err);
    return [];
  }
}

export function formatRetrievedContext(results: RetrievedWeakAnswer[]): string {
  if (!results || results.length === 0) {
    return '';
  }

  const lines = ['Prior weak answers from this candidate:'];
  results.forEach((r, idx) => {
    const truncatedAnswer =
      r.answer_transcript.length > 200
        ? r.answer_transcript.substring(0, 200) + '...'
        : r.answer_transcript;

    lines.push(
      `\n${idx + 1}. Q: ${r.question}\n` +
      `   A: ${truncatedAnswer}\n` +
      `   Score: ${r.technical_accuracy}/10 | ` +
      `Suggested follow-up: ${r.follow_up_angle || 'N/A'}`
    );
  });

  return lines.join('\n');
}
