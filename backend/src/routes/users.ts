import { Router, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getUserWeakTopics } from '../services/weakTopicTracker';

const router = Router();

// GET /users/me
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const user = { ...req.user };
  
  const maskKey = (key?: string | null) => {
    if (!key) return null;
    if (key.length <= 8) return '********';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    openai_api_key: maskKey(user.openai_api_key),
    anthropic_api_key: maskKey(user.anthropic_api_key),
    gemini_api_key: maskKey(user.gemini_api_key),
    groq_api_key: maskKey(user.groq_api_key),
    system_key_usage_count: user.system_key_usage_count
  });
});

// PATCH /users/me/api-keys
router.patch('/me/api-keys', requireAuth, async (req: AuthRequest, res: Response) => {
  const { openai_api_key, anthropic_api_key, gemini_api_key, groq_api_key } = req.body;
  const db = getDb();

  try {
    const valOrNull = (val: any) => {
      if (val === undefined) return undefined;
      if (val === null || String(val).trim() === '') return null;
      return String(val).trim();
    };

    const openAIVal = valOrNull(openai_api_key);
    const anthropicVal = valOrNull(anthropic_api_key);
    const geminiVal = valOrNull(gemini_api_key);
    const groqVal = valOrNull(groq_api_key);

    const updates: string[] = [];
    const params: any[] = [];

    if (openAIVal !== undefined) {
      updates.push('openai_api_key = ?');
      params.push(openAIVal);
    }
    if (anthropicVal !== undefined) {
      updates.push('anthropic_api_key = ?');
      params.push(anthropicVal);
    }
    if (geminiVal !== undefined) {
      updates.push('gemini_api_key = ?');
      params.push(geminiVal);
    }
    if (groqVal !== undefined) {
      updates.push('groq_api_key = ?');
      params.push(groqVal);
    }

    if (updates.length > 0) {
      params.push(req.userId);
      await db.run(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    return res.json({ status: 'success', message: 'API keys updated successfully' });
  } catch (error) {
    console.error('Error updating keys:', error);
    return res.status(500).json({ detail: 'Failed to update API keys' });
  }
});

// GET /users/me/dashboard
router.get('/me/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();

    // Fetch all sessions for this user
    const sessions = await db.all(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC',
      [req.userId]
    );

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;

    const sessionSummaries: any[] = [];
    const allScores: number[] = [];

    for (const session of sessions) {
      // Fetch exchanges and their technical scores
      const exchanges = await db.all(
        `SELECT e.id, e.answer_transcript, s.technical_accuracy
         FROM exchanges e
         LEFT JOIN scores s ON s.exchange_id = e.id
         WHERE e.session_id = ?`,
        [session.id]
      );

      let questionsAnswered = 0;
      const sessionScores: number[] = [];

      for (const ex of exchanges) {
        if (ex.answer_transcript !== null) {
          questionsAnswered++;
          if (ex.technical_accuracy !== null && ex.technical_accuracy !== undefined) {
            sessionScores.push(ex.technical_accuracy);
            allScores.push(ex.technical_accuracy);
          }
        }
      }

      const avgSessionScore =
        sessionScores.length > 0
          ? sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length
          : null;

      sessionSummaries.push({
        id: session.id,
        topic: session.topic,
        difficulty: session.difficulty,
        status: session.status,
        integrity_score: session.integrity_score,
        total_questions: session.total_questions,
        questions_answered: questionsAnswered,
        avg_score: avgSessionScore !== null ? Math.round(avgSessionScore * 10) / 10 : null,
        started_at: session.started_at,
        ended_at: session.ended_at,
      });
    }

    const totalQuestionsAnswered = sessionSummaries.reduce((sum, s) => sum + s.questions_answered, 0);
    const overallAvg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;

    return res.json({
      total_sessions: totalSessions,
      completed_sessions: completedSessions,
      avg_score: overallAvg !== null ? Math.round(overallAvg * 10) / 10 : null,
      total_questions_answered: totalQuestionsAnswered,
      recent_sessions: sessionSummaries.slice(0, 10),
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    return res.status(500).json({ detail: 'Internal server error loading dashboard details' });
  }
});

// GET /users/me/sessions
router.get('/me/sessions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();

    // Fetch all sessions for this user
    const sessions = await db.all(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC',
      [req.userId]
    );

    const summaries: any[] = [];

    for (const session of sessions) {
      const exchanges = await db.all(
        `SELECT e.id, e.answer_transcript, s.technical_accuracy
         FROM exchanges e
         LEFT JOIN scores s ON s.exchange_id = e.id
         WHERE e.session_id = ?`,
        [session.id]
      );

      let questionsAnswered = 0;
      const sessionScores: number[] = [];

      for (const ex of exchanges) {
        if (ex.answer_transcript !== null) {
          questionsAnswered++;
          if (ex.technical_accuracy !== null && ex.technical_accuracy !== undefined) {
            sessionScores.push(ex.technical_accuracy);
          }
        }
      }

      const avgScore =
        sessionScores.length > 0
          ? sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length
          : null;

      summaries.push({
        id: session.id,
        topic: session.topic,
        difficulty: session.difficulty,
        status: session.status,
        integrity_score: session.integrity_score,
        total_questions: session.total_questions,
        questions_answered: questionsAnswered,
        avg_score: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
        started_at: session.started_at,
        ended_at: session.ended_at,
      });
    }

    return res.json(summaries);
  } catch (error) {
    console.error('Error loading sessions:', error);
    return res.status(500).json({ detail: 'Internal server error loading user sessions' });
  }
});

// GET /users/me/weak-topics
router.get('/me/weak-topics', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const topics = await getUserWeakTopics(req.userId!);
    return res.json(topics);
  } catch (error) {
    console.error('Error fetching weak topics:', error);
    return res.status(500).json({ detail: 'Internal server error loading user weak topics' });
  }
});

export default router;
