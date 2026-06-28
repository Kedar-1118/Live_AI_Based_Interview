import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { getDb } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { generateFirstQuestion } from '../services/interviewerAgent';
import { transcribeAudio } from '../services/transcriptionService';
import { analyzeSpeech } from '../services/speechAnalyzer';
import { config } from '../config';

const router = Router();

// Setup multer for temporary file uploads
const upload = multer({
  dest: path.resolve(config.UPLOAD_DIR, 'temp'),
  limits: { fileSize: config.MAX_AUDIO_SIZE_MB * 1024 * 1024 }
});

// POST /sessions/create
router.post('/create', requireAuth, async (req: AuthRequest, res: Response) => {
  const { topic, difficulty, duration_minutes, total_questions, llm_provider, llm_model } = req.body;

  if (!topic) {
    return res.status(400).json({ detail: 'Topic is required' });
  }

  try {
    const db = getDb();
    const sessionId = uuidv4();
    const startedAt = new Date().toISOString();

    const provider = llm_provider || config.DEFAULT_LLM_PROVIDER;
    const model = llm_model || config.DEFAULT_LLM_MODEL;

    // Create session record
    await db.run(
      `INSERT INTO sessions 
        (id, user_id, topic, difficulty, duration_minutes, status, integrity_score, total_questions, started_at, llm_provider, llm_model) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        req.userId,
        topic,
        difficulty || 'medium',
        duration_minutes || 30,
        'active',
        100,
        total_questions || 10,
        startedAt,
        provider,
        model
      ]
    );

    // Generate first question
    const firstQuestion = await generateFirstQuestion(topic, difficulty || 'medium', provider, model, req.user);

    // Create first exchange record (index 1)
    const exchangeId = uuidv4();
    await db.run(
      'INSERT INTO exchanges (id, session_id, question, question_index, created_at) VALUES (?, ?, ?, ?, ?)',
      [exchangeId, sessionId, firstQuestion, 1, startedAt]
    );

    // Load session with exchanges to return
    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    const exchanges = await db.all('SELECT * FROM exchanges WHERE session_id = ? ORDER BY question_index ASC', [sessionId]);

    return res.status(201).json({
      ...session,
      exchanges
    });
  } catch (error) {
    console.error('Session creation error:', error);
    return res.status(500).json({ detail: 'Internal server error during session creation' });
  }
});

// GET /sessions/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const db = getDb();
    const session = await db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [id, req.userId]);

    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    // Load exchanges and their corresponding scores
    const exchanges = await db.all(
      `SELECT e.*, 
              s.technical_accuracy, s.definition_present, s.mechanism_explained, s.example_given, 
              s.edge_cases_mentioned, s.missing_concepts, s.follow_up_angle, s.wpm, s.filler_count, 
              s.longest_pause_seconds, s.confidence_proxy, s.gaze_fluency_correlation
       FROM exchanges e
       LEFT JOIN scores s ON s.exchange_id = e.id
       WHERE e.session_id = ?
       ORDER BY e.question_index ASC`,
      [id]
    );

    const formattedExchanges = exchanges.map(ex => {
      const score = ex.technical_accuracy !== null ? {
        id: ex.id,
        exchange_id: ex.id,
        technical_accuracy: ex.technical_accuracy,
        definition_present: !!ex.definition_present,
        mechanism_explained: !!ex.mechanism_explained,
        example_given: !!ex.example_given,
        edge_cases_mentioned: !!ex.edge_cases_mentioned,
        missing_concepts: ex.missing_concepts ? JSON.parse(ex.missing_concepts) : null,
        follow_up_angle: ex.follow_up_angle,
        wpm: ex.wpm,
        filler_count: ex.filler_count,
        longest_pause_seconds: ex.longest_pause_seconds,
        confidence_proxy: ex.confidence_proxy,
        gaze_fluency_correlation: ex.gaze_fluency_correlation
      } : null;

      return {
        id: ex.id,
        session_id: ex.session_id,
        question: ex.question,
        answer_transcript: ex.answer_transcript,
        question_index: ex.question_index,
        created_at: ex.created_at,
        score
      };
    });

    return res.json({
      ...session,
      exchanges: formattedExchanges
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return res.status(500).json({ detail: 'Internal server error fetching session details' });
  }
});

// PATCH /sessions/:id/end
router.patch('/:id/end', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const db = getDb();
    const session = await db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [id, req.userId]);

    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ detail: 'Session is already ended' });
    }

    const endedAt = new Date().toISOString();
    await db.run('UPDATE sessions SET status = ?, ended_at = ? WHERE id = ?', ['completed', endedAt, id]);

    const updatedSession = await db.get('SELECT * FROM sessions WHERE id = ?', [id]);
    const exchanges = await db.all('SELECT * FROM exchanges WHERE session_id = ? ORDER BY question_index ASC', [id]);

    return res.json({
      ...updatedSession,
      exchanges
    });
  } catch (error) {
    console.error('Error ending session:', error);
    return res.status(500).json({ detail: 'Internal server error while ending session' });
  }
});

// POST /sessions/:id/calibration/submit
router.post('/:id/calibration/submit', requireAuth, upload.single('audio'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ detail: 'No audio file provided' });
  }

  try {
    const db = getDb();
    const session = await db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [id, req.userId]);

    if (!session) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ detail: 'Session not found' });
    }

    // Save audio permanently
    const calibDir = path.join(config.UPLOAD_DIR, 'calibration', id);
    fs.mkdirSync(calibDir, { recursive: true });

    const permanentPath = path.join(calibDir, `${uuidv4()}.webm`);
    fs.renameSync(req.file.path, permanentPath);

    // Transcribe and analyze speech
    const transcriptionResult = await transcribeAudio(permanentPath, req.user, 2, session.llm_provider);
    const speechAnalysis = analyzeSpeech(
      transcriptionResult.word_timestamps,
      transcriptionResult.transcript
    );

    return res.json({
      wpm: speechAnalysis.avg_wpm,
      transcript: transcriptionResult.transcript,
    });
  } catch (error) {
    console.error('Error submitting calibration:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ detail: 'Internal server error processing calibration audio' });
  }
});

// POST /sessions/:id/calibration/complete
router.post('/:id/calibration/complete', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { avg_wpm, wpm_std_dev, gaze_center_x, gaze_center_y, gaze_std_dev, head_pose_range } = req.body;

  try {
    const db = getDb();
    const session = await db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [id, req.userId]);

    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    const headPoseJson = JSON.stringify(head_pose_range);

    const existingBaseline = await db.get('SELECT id FROM baselines WHERE session_id = ?', [id]);
    if (existingBaseline) {
      await db.run(
        `UPDATE baselines 
         SET avg_wpm = ?, wpm_std_dev = ?, gaze_center_x = ?, gaze_center_y = ?, gaze_std_dev = ?, head_pose_range = ? 
         WHERE session_id = ?`,
        [avg_wpm, wpm_std_dev, gaze_center_x, gaze_center_y, gaze_std_dev, headPoseJson, id]
      );
    } else {
      const baselineId = uuidv4();
      const capturedAt = new Date().toISOString();
      await db.run(
        `INSERT INTO baselines 
          (id, session_id, avg_wpm, wpm_std_dev, gaze_center_x, gaze_center_y, gaze_std_dev, head_pose_range, captured_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [baselineId, id, avg_wpm, wpm_std_dev, gaze_center_x, gaze_center_y, gaze_std_dev, headPoseJson, capturedAt]
      );
    }

    return res.json({ status: 'success', message: 'Calibration baseline saved successfully' });
  } catch (error) {
    console.error('Error saving calibration baseline:', error);
    return res.status(500).json({ detail: 'Internal server error saving calibration details' });
  }
});

// GET /sessions/:id/baseline
router.get('/:id/baseline', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const db = getDb();
    const session = await db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [id, req.userId]);

    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    const baseline = await db.get('SELECT * FROM baselines WHERE session_id = ?', [id]);
    if (!baseline) {
      return res.status(404).json({ detail: 'Baseline calibration not found for this session' });
    }

    // Parse head_pose_range back
    if (baseline.head_pose_range) {
      baseline.head_pose_range = JSON.parse(baseline.head_pose_range);
    }

    return res.json(baseline);
  } catch (error) {
    console.error('Error fetching baseline:', error);
    return res.status(500).json({ detail: 'Internal server error fetching baseline' });
  }
});

// GET /sessions/:id/report
router.get('/:id/report', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const db = getDb();
    const session = await db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [id, req.userId]);

    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    const exchanges = await db.all(
      `SELECT e.*, s.gaze_fluency_correlation, s.technical_accuracy
       FROM exchanges e
       LEFT JOIN scores s ON s.exchange_id = e.id
       WHERE e.session_id = ?
       ORDER BY e.question_index ASC`,
      [id]
    );

    const events = await db.all(
      'SELECT * FROM integrity_events WHERE session_id = ? ORDER BY timestamp_ms ASC',
      [id]
    );

    // Determine Verdict
    let verdict = 'EXCELLENT';
    const score = session.integrity_score;
    if (score < 70) {
      verdict = 'SUSPICIOUS';
    } else if (score < 85) {
      verdict = 'REVIEW_RECOMMENDED';
    }

    // Build timeline
    const sessionStartMs = new Date(session.started_at + ' Z').getTime();
    const exchangeEventsMap: Record<string, any[]> = {};

    for (const evt of events) {
      const key = evt.exchange_id || 'general';
      if (!exchangeEventsMap[key]) {
        exchangeEventsMap[key] = [];
      }

      const relMs = Number(evt.timestamp_ms) - sessionStartMs;
      const relSec = Math.max(0, Math.floor(relMs / 1000));
      const mm = String(Math.floor(relSec / 60)).padStart(2, '0');
      const ss = String(relSec % 60).padStart(2, '0');
      const timeStr = `${mm}:${ss}`;

      let metadata = {};
      try {
        metadata = evt.metadata_json ? JSON.parse(evt.metadata_json) : {};
      } catch (err) {}

      exchangeEventsMap[key].push({
        type: evt.event_type,
        severity: evt.severity,
        timestamp: timeStr,
        metadata,
      });
    }

    const timeline: any[] = [];

    // Add general/calibration phase flags if any
    const generalFlags = exchangeEventsMap['general'] || [];
    if (generalFlags.length > 0) {
      const hasSevere = generalFlags.some(f => f.severity === 'high' || f.severity === 'medium');
      timeline.push({
        question_index: 0,
        question: 'Baseline Calibration & Setup',
        flags: generalFlags,
        suspicion_level: hasSevere ? 'moderate' : 'low',
      });
    }

    for (const ex of exchanges) {
      const flags = exchangeEventsMap[ex.id] || [];
      let suspicion = 'low';
      if (flags.some(f => f.severity === 'high')) {
        suspicion = 'high';
      } else if (flags.some(f => f.severity === 'medium') || flags.length > 2) {
        suspicion = 'moderate';
      }

      timeline.push({
        question_index: ex.question_index,
        question: ex.question,
        flags,
        suspicion_level: suspicion,
      });
    }

    // Gather correlations
    const correlations = exchanges
      .map(e => e.gaze_fluency_correlation)
      .filter((c): c is number => c !== null && c !== undefined);

    const avgCorrelation =
      correlations.length > 0 ? correlations.reduce((a, b) => a + b, 0) / correlations.length : 0.0;

    // Count consistent deviation directions
    const deviationTypes = events
      .map(e => e.event_type)
      .filter(t => ['notes_below_camera', 'second_monitor_left', 'second_monitor_right'].includes(t));

    let dominantSuspiciousZone = 'none';
    if (deviationTypes.length > 0) {
      // Find mode
      const frequencies: Record<string, number> = {};
      let maxFreq = 0;
      for (const t of deviationTypes) {
        frequencies[t] = (frequencies[t] || 0) + 1;
        if (frequencies[t] > maxFreq) {
          maxFreq = frequencies[t];
          dominantSuspiciousZone = t;
        }
      }
    }

    let summaryText = 'No significant cheating patterns detected.';
    if (score < 100) {
      if (avgCorrelation > 0.5) {
        summaryText = `Candidate showed a notable gaze-fluency correlation (${avgCorrelation.toFixed(2)}) preceding fluent answers. `;
      } else {
        summaryText = 'Candidate showed behavioral anomalies. ';
      }

      if (dominantSuspiciousZone !== 'none') {
        const friendlyZone = dominantSuspiciousZone.replace(/_/g, ' ');
        summaryText += `Dominant suspicious zone: ${friendlyZone}.`;
      }
    }

    return res.json({
      session_id: session.id,
      integrity_score: score,
      verdict,
      timeline,
      pattern_analysis: {
        gaze_fluency_correlation: Math.round(avgCorrelation * 100) / 100,
        consistent_deviation_direction: new Set(deviationTypes).size === 1 && deviationTypes.length > 0,
        dominant_suspicious_zone: dominantSuspiciousZone,
        summary: summaryText,
      },
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ detail: 'Internal server error generating report' });
  }
});

export default router;
