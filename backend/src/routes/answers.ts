import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { getDb } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { evaluateAnswer, EvaluationResult } from '../services/evaluatorAgent';
import { generateNextQuestion } from '../services/interviewerAgent';
import { transcribeAudio } from '../services/transcriptionService';
import { analyzeSpeech } from '../services/speechAnalyzer';
import { embedAndStoreExchange, retrieveRelevantWeakAnswers, formatRetrievedContext } from '../services/vectorMemory';
import { updateWeakTopics } from '../services/weakTopicTracker';
import { computeGazeFluencyCorrelation, updateIntegrityScore } from '../services/integrityEngine';
import { config } from '../config';

const router = Router();

// Setup multer for temporary audio uploads
const upload = multer({
  dest: path.resolve(config.UPLOAD_DIR, 'temp'),
  limits: { fileSize: config.MAX_AUDIO_SIZE_MB * 1024 * 1024 }
});

// Helper: Common answer evaluation and next question logic
async function processEvaluationAndNextQuestion(
  session: any,
  currentExchange: any,
  transcript: string,
  user: any
): Promise<{ evaluation: EvaluationResult; nextQuestionText: string | null; sessionComplete: boolean }> {
  const db = getDb();

  const provider = session.llm_provider || 'anthropic';
  const model = session.llm_model || 'claude-sonnet-4-20250514';

  // 1. Run technical evaluation
  const evaluation = await evaluateAnswer(currentExchange.question, transcript, session.topic, provider, model, user);

  // 2. Insert core Score record
  const scoreId = uuidv4();
  await db.run(
    `INSERT INTO scores 
      (id, exchange_id, technical_accuracy, definition_present, mechanism_explained, example_given, edge_cases_mentioned, missing_concepts, follow_up_angle) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      scoreId,
      currentExchange.id,
      evaluation.technical_accuracy,
      evaluation.definition_present ? 1 : 0,
      evaluation.mechanism_explained ? 1 : 0,
      evaluation.example_given ? 1 : 0,
      evaluation.edge_cases_mentioned ? 1 : 0,
      evaluation.missing_concepts ? JSON.stringify(evaluation.missing_concepts) : null,
      evaluation.follow_up_angle
    ]
  );

  // 3. Vector memory storage and weak topic tracking in "background" (non-blocking)
  embedAndStoreExchange(currentExchange.id, currentExchange.question, transcript, user)
    .catch(err => console.error('Background embedding storage failed:', err));

  updateWeakTopics(session.user_id, session.topic, evaluation)
    .catch(err => console.error('Background weak topic tracker failed:', err));

  // 4. Determine next step
  const nextIndex = currentExchange.question_index + 1;
  const sessionComplete = nextIndex > session.total_questions;

  let nextQuestionText: string | null = null;

  if (!sessionComplete) {
    // Build running performance summary
    const allExchanges = await db.all(
      `SELECT e.id, s.technical_accuracy 
       FROM exchanges e
       LEFT JOIN scores s ON s.exchange_id = e.id
       WHERE e.session_id = ?
       ORDER BY e.question_index ASC`,
      [session.id]
    );

    const scoresList = allExchanges
      .map(ex => ex.technical_accuracy)
      .filter((s): s is number => s !== null && s !== undefined);

    const avgScore = scoresList.length > 0 ? scoresList.reduce((a, b) => a + b, 0) / scoresList.length : 0.0;
    const performanceSummary =
      `Questions answered: ${scoresList.length}/${session.total_questions}. ` +
      `Average score: ${avgScore.toFixed(1)}/10.`;

    // Retrieve weak answers from memory
    let retrievedContext = '';
    try {
      const weakAnswers = await retrieveRelevantWeakAnswers(session.user_id, currentExchange.question, user);
      retrievedContext = formatRetrievedContext(weakAnswers);
    } catch (err) {
      console.warn('Memory retrieval failed (non-critical):', err);
    }

    // Generate next question
    nextQuestionText = await generateNextQuestion(
      session.topic,
      session.difficulty,
      evaluation,
      nextIndex,
      session.total_questions,
      performanceSummary,
      retrievedContext,
      provider,
      model,
      user
    );

    // Create next exchange
    const nextExchangeId = uuidv4();
    const now = new Date().toISOString();
    await db.run(
      'INSERT INTO exchanges (id, session_id, question, question_index, created_at) VALUES (?, ?, ?, ?, ?)',
      [nextExchangeId, session.id, nextQuestionText, nextIndex, now]
    );
  } else {
    // End the session
    const endedAt = new Date().toISOString();
    await db.run('UPDATE sessions SET status = ?, ended_at = ? WHERE id = ?', ['completed', endedAt, session.id]);
  }

  return { evaluation, nextQuestionText, sessionComplete };
}

// GET active unanswered exchange
async function getActiveExchange(sessionId: string): Promise<any> {
  const db = getDb();
  const exchange = await db.get(
    'SELECT * FROM exchanges WHERE session_id = ? AND answer_transcript IS NULL ORDER BY question_index ASC LIMIT 1',
    [sessionId]
  );
  return exchange;
}

// Validate session active and owned by user
async function validateSession(sessionId: string, userId: string): Promise<any> {
  const db = getDb();
  const session = await db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
  if (!session) {
    const err: any = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  if (session.status !== 'active') {
    const err: any = new Error('Session is not active');
    err.status = 400;
    throw err;
  }
  return session;
}

// POST /answers/submit
router.post('/submit', requireAuth, async (req: AuthRequest, res: Response) => {
  const { session_id, answer_text } = req.body;

  if (!session_id || !answer_text) {
    return res.status(400).json({ detail: 'session_id and answer_text are required' });
  }

  try {
    const session = await validateSession(session_id, req.userId!);
    const currentExchange = await getActiveExchange(session_id);

    if (!currentExchange) {
      return res.status(400).json({ detail: 'No pending question found' });
    }

    const db = getDb();

    // Store transcript
    await db.run('UPDATE exchanges SET answer_transcript = ? WHERE id = ?', [answer_text, currentExchange.id]);

    const { evaluation, nextQuestionText, sessionComplete } = await processEvaluationAndNextQuestion(
      session,
      currentExchange,
      answer_text,
      req.user
    );

    return res.json({
      exchange_id: currentExchange.id,
      evaluation,
      next_question: nextQuestionText,
      question_index: currentExchange.question_index,
      session_complete: sessionComplete,
    });
  } catch (error: any) {
    console.error('Text submission error:', error);
    const status = error.status || 500;
    return res.status(status).json({ detail: error.message || 'Internal server error submitting text answer' });
  }
});

// POST /answers/submit-audio
router.post('/submit-audio', requireAuth, upload.single('audio'), async (req: AuthRequest, res: Response) => {
  const { session_id } = req.body;

  if (!session_id) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ detail: 'session_id is required' });
  }

  if (!req.file) {
    return res.status(400).json({ detail: 'No audio file provided' });
  }

  try {
    const session = await validateSession(session_id, req.userId!);
    const currentExchange = await getActiveExchange(session_id);

    if (!currentExchange) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ detail: 'No pending question found' });
    }

    // Determine path extension
    let ext = '.webm';
    if (req.file.mimetype) {
      const mimeMap: Record<string, string> = {
        'audio/webm': '.webm',
        'audio/ogg': '.ogg',
        'audio/wav': '.wav',
        'audio/mp4': '.mp4',
        'audio/mpeg': '.mp3',
      };
      ext = mimeMap[req.file.mimetype] || '.webm';
    }

    const audioDir = path.join(config.UPLOAD_DIR, 'audio', session_id);
    fs.mkdirSync(audioDir, { recursive: true });

    const audioPath = path.join(audioDir, `${currentExchange.id}${ext}`);
    fs.renameSync(req.file.path, audioPath);

    console.log(`Audio saved: ${audioPath} (${req.file.size} bytes)`);

    // ─── Parallel Processing Pipeline ───
    const transcriptionResult = await transcribeAudio(audioPath, req.user);

    const speechAnalysis = analyzeSpeech(
      transcriptionResult.word_timestamps,
      transcriptionResult.transcript
    );

    const db = getDb();
    await db.run('UPDATE exchanges SET answer_transcript = ? WHERE id = ?', [
      transcriptionResult.transcript,
      currentExchange.id,
    ]);

    // Calculate gaze-fluency correlation and update score
    let correlation = 0.0;
    try {
      correlation = await computeGazeFluencyCorrelation(
        session.id,
        currentExchange.id,
        speechAnalysis.wpm_segments
      );
    } catch (err) {
      console.error('Error computing correlation:', err);
    }

    try {
      await updateIntegrityScore(session.id, correlation, currentExchange.id);
    } catch (err) {
      console.error('Error updating integrity score:', err);
    }

    // ─── Sequential: Evaluation + Next Question ───
    const { evaluation, nextQuestionText, sessionComplete } = await processEvaluationAndNextQuestion(
      session,
      currentExchange,
      transcriptionResult.transcript,
      req.user
    );

    // Save speech stats into score record
    await db.run(
      `UPDATE scores 
       SET wpm = ?, filler_count = ?, longest_pause_seconds = ?, confidence_proxy = ?, gaze_fluency_correlation = ? 
       WHERE exchange_id = ?`,
      [
        Math.floor(speechAnalysis.avg_wpm),
        speechAnalysis.filler_count,
        speechAnalysis.longest_pause_seconds,
        speechAnalysis.confidence_proxy,
        correlation,
        currentExchange.id,
      ]
    );

    // Format speech analysis response properties matching Python models
    const speechResponse = {
      avg_wpm: speechAnalysis.avg_wpm,
      wpm_std_dev: speechAnalysis.wpm_std_dev,
      total_duration: speechAnalysis.total_duration,
      word_count: speechAnalysis.word_count,
      pause_count: speechAnalysis.pause_count,
      longest_pause_seconds: speechAnalysis.longest_pause_seconds,
      filler_count: speechAnalysis.filler_count,
      filler_words: speechAnalysis.filler_words,
      confidence_proxy: speechAnalysis.confidence_proxy,
    };

    return res.json({
      exchange_id: currentExchange.id,
      transcript: transcriptionResult.transcript,
      evaluation,
      speech_analysis: speechResponse,
      next_question: nextQuestionText,
      question_index: currentExchange.question_index,
      session_complete: sessionComplete,
    });
  } catch (error: any) {
    console.error('Audio submission error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    const status = error.status || 500;
    return res.status(status).json({ detail: error.message || 'Internal server error submitting audio answer' });
  }
});

export default router;
