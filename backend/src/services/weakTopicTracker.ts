import { getDb } from '../db';
import { EvaluationResult } from './evaluatorAgent';
import { v4 as uuidv4 } from 'uuid';

const WEAK_SCORE_THRESHOLD = 7;

export async function updateWeakTopics(
  userId: string,
  topic: string,
  evaluation: EvaluationResult
): Promise<void> {
  try {
    const score = evaluation.technical_accuracy;

    if (score > WEAK_SCORE_THRESHOLD) {
      console.log(`Score ${score} above threshold ${WEAK_SCORE_THRESHOLD} — skipping weak topic update`);
      return;
    }

    const subtopic = extractSubtopic(evaluation);
    const db = getDb();

    // Look for existing weak topic record
    const existing = await db.get(
      'SELECT id, avg_score, occurrence FROM weak_topics WHERE user_id = ? AND topic = ? AND subtopic = ?',
      [userId, topic, subtopic]
    );

    const now = new Date().toISOString();

    if (existing) {
      const oldAvg = existing.avg_score !== null ? existing.avg_score : score;
      const oldCount = existing.occurrence;
      const newAvg = (oldAvg * oldCount + score) / (oldCount + 1);

      await db.run(
        'UPDATE weak_topics SET avg_score = ?, occurrence = ?, last_seen = ? WHERE id = ?',
        [Math.round(newAvg * 100) / 100, oldCount + 1, now, existing.id]
      );

      console.log(
        `Updated weak topic: ${topic}/${subtopic} — ` +
        `avg_score: ${Math.round(newAvg * 100) / 100}, occurrences: ${oldCount + 1}`
      );
    } else {
      const id = uuidv4();
      await db.run(
        'INSERT INTO weak_topics (id, user_id, topic, subtopic, avg_score, occurrence, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, userId, topic, subtopic, score, 1, now]
      );

      console.log(`New weak topic recorded: ${topic}/${subtopic} — score: ${score}`);
    }
  } catch (err) {
    console.error('Failed to update weak topics:', err);
  }
}

function extractSubtopic(evaluation: EvaluationResult): string {
  if (evaluation.missing_concepts && evaluation.missing_concepts.length > 0) {
    const concept = evaluation.missing_concepts[0];
    return concept.length > 100 ? concept.substring(0, 100) : concept;
  }

  if (evaluation.follow_up_angle) {
    const angle = evaluation.follow_up_angle;
    return angle.length > 100 ? angle.substring(0, 100) : angle;
  }

  // Fallback to weakest rubric dimension
  if (!evaluation.definition_present) {
    return 'Core definitions';
  }
  if (!evaluation.mechanism_explained) {
    return 'Mechanism explanation';
  }
  if (!evaluation.example_given) {
    return 'Practical examples';
  }
  if (!evaluation.edge_cases_mentioned) {
    return 'Edge case awareness';
  }

  return 'General understanding';
}

export async function getUserWeakTopics(userId: string, limit: number = 20): Promise<any[]> {
  const db = getDb();
  return db.all(
    'SELECT * FROM weak_topics WHERE user_id = ? ORDER BY avg_score ASC LIMIT ?',
    [userId, limit]
  );
}
