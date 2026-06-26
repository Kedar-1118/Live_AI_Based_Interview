import { getDb } from '../db';
import { wsManager } from './websocketManager';
import { v4 as uuidv4 } from 'uuid';
import { WPMSegment } from './speechAnalyzer';

// Sliding window buffer for real-time gaze & head pose tracking
// Format: sessionId -> list of signal dicts
const sessionBuffers: Map<string, any[]> = new Map();
const MAX_BUFFER_DURATION_S = 15; // keep last 15 seconds of signals

function getBuffer(sessionId: string): any[] {
  if (!sessionBuffers.has(sessionId)) {
    sessionBuffers.set(sessionId, []);
  }
  return sessionBuffers.get(sessionId)!;
}

function cleanupBuffer(sessionId: string, currentTsMs: number) {
  const buffer = getBuffer(sessionId);
  const cutoff = currentTsMs - MAX_BUFFER_DURATION_S * 1000;
  const filtered = buffer.filter(s => (s.timestamp || 0) > cutoff);
  sessionBuffers.set(sessionId, filtered);
}

export async function processBehavioralSignal(
  sessionId: string,
  signal: any
): Promise<void> {
  const currentTs = signal.timestamp || Date.now();
  const sessionIdStr = sessionId;

  // Add signal to buffer
  const buffer = getBuffer(sessionIdStr);
  buffer.push(signal);
  cleanupBuffer(sessionIdStr, currentTs);

  const db = getDb();

  // 0. Custom direct event sent from client (e.g. tab_switch, fullscreen_exit)
  if (signal.event_type) {
    const eventType = signal.event_type;
    const severity = signal.severity || 'medium';
    const metadata = signal.metadata || { message: `Client reported event: ${eventType}` };
    await logAndNotifyEventIfNew(sessionId, eventType, severity, currentTs, metadata);
    return;
  }

  // 1. Face Count Check
  const faceCount = typeof signal.face_count === 'number' ? signal.face_count : 1;
  let eventType: string | null = null;
  let severity: string | null = null;
  let metadata: any = {};

  if (faceCount === 0) {
    eventType = 'face_missing';
    severity = 'medium';
    metadata = { message: 'Candidate face not detected in frame' };
  } else if (faceCount > 1) {
    eventType = 'multiple_faces';
    severity = 'high';
    metadata = { face_count: faceCount, message: 'Multiple faces detected' };
  }

  if (eventType && severity) {
    await logAndNotifyEvent(sessionId, eventType, severity, currentTs, metadata);
    return;
  }

  // 2. Gaze and Head Pose Check (Requires Baseline)
  const baseline = await db.get('SELECT * FROM baselines WHERE session_id = ?', [sessionId]);
  if (!baseline) {
    // Calibration phase, ignore deviations
    return;
  }

  const gaze = signal.gaze;
  const headPose = signal.head_pose;

  if (!gaze || !headPose) {
    return;
  }

  const gazeX = gaze.x !== undefined ? gaze.x : 0.5;
  const gazeY = gaze.y !== undefined ? gaze.y : 0.5;
  const yaw = headPose.yaw !== undefined ? headPose.yaw : 0.0;
  const pitch = headPose.pitch !== undefined ? headPose.pitch : 0.0;

  const baselineGazeCenterX = baseline.gaze_center_x !== null ? baseline.gaze_center_x : 0.5;
  const baselineGazeCenterY = baseline.gaze_center_y !== null ? baseline.gaze_center_y : 0.5;

  const devX = gazeX - baselineGazeCenterX;
  const devY = gazeY - baselineGazeCenterY;
  const totalDeviation = Math.sqrt(devX * devX + devY * devY);

  const gazeStdDev = baseline.gaze_std_dev !== null ? baseline.gaze_std_dev : 0.1;

  if (totalDeviation > gazeStdDev * 2) {
    // Sustained deviation checks (past 3 seconds)
    const threeSecsAgo = currentTs - 3000;
    const recentSignals = buffer.filter(s => (s.timestamp || 0) >= threeSecsAgo);

    let deviatingCount = 0;
    let directionXSum = 0;
    let directionYSum = 0;

    for (const s of recentSignals) {
      const sg = s.gaze;
      if (!sg) continue;
      const sxDev = (sg.x !== undefined ? sg.x : 0.5) - baselineGazeCenterX;
      const syDev = (sg.y !== undefined ? sg.y : 0.5) - baselineGazeCenterY;
      const sDev = Math.sqrt(sxDev * sxDev + syDev * syDev);

      if (sDev > gazeStdDev * 2) {
        deviatingCount++;
        directionXSum += sxDev > 0 ? 1 : -1;
        directionYSum += syDev > 0 ? 1 : -1;
      }
    }

    if (recentSignals.length >= 2 && deviatingCount / recentSignals.length >= 0.8) {
      // Net deviations direction mapping
      const netX = directionXSum / recentSignals.length;
      const netY = directionYSum / recentSignals.length;

      if (gazeY > 0.8 && pitch > 20) {
        eventType = 'notes_below_camera';
        severity = 'medium';
        metadata = { message: 'Candidate looking down at potential notes', pitch, gaze_y: gazeY };
      } else if (gazeX < 0.15) {
        eventType = 'second_monitor_left';
        severity = 'medium';
        metadata = { message: 'Gaze shifted to second monitor (left)', gaze_x: gazeX };
      } else if (gazeX > 0.85) {
        eventType = 'second_monitor_right';
        severity = 'medium';
        metadata = { message: 'Gaze shifted to second monitor (right)', gaze_x: gazeX };
      } else {
        eventType = 'gaze_deviation';
        severity = 'low';
        metadata = { message: 'Sustained gaze deviation', deviation_magnitude: totalDeviation };
      }

      await logAndNotifyEventIfNew(sessionId, eventType, severity, currentTs, metadata);
    }
  }
}

export async function logAndNotifyEvent(
  sessionId: string,
  eventType: string,
  severity: string,
  timestampMs: number,
  metadata: any
): Promise<void> {
  const db = getDb();

  // Find active exchange (unanswered) to link it
  const exchange = await db.get(
    'SELECT id FROM exchanges WHERE session_id = ? AND answer_transcript IS NULL ORDER BY question_index ASC LIMIT 1',
    [sessionId]
  );
  const exchangeId = exchange ? exchange.id : null;

  const eventId = uuidv4();
  await db.run(
    'INSERT INTO integrity_events (id, session_id, exchange_id, event_type, severity, timestamp_ms, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [eventId, sessionId, exchangeId, eventType, severity, timestampMs, JSON.stringify(metadata)]
  );

  const payload = {
    type: 'integrity_alert',
    payload: {
      event_type: eventType,
      severity,
      timestamp_ms: timestampMs,
      metadata,
    },
  };
  wsManager.sendPersonalMessage(payload, sessionId);
  console.warn(`Integrity Event Logged: ${eventType} (severity=${severity}) for session ${sessionId}`);
}

export async function logAndNotifyEventIfNew(
  sessionId: string,
  eventType: string,
  severity: string,
  timestampMs: number,
  metadata: any
): Promise<void> {
  const db = getDb();
  const eightSecsAgo = timestampMs - 8000;

  // Rate limit: check if an event of same type occurred within last 8 seconds
  const lastEvent = await db.get(
    'SELECT id FROM integrity_events WHERE session_id = ? AND event_type = ? AND timestamp_ms >= ? LIMIT 1',
    [sessionId, eventType, eightSecsAgo]
  );

  if (!lastEvent) {
    await logAndNotifyEvent(sessionId, eventType, severity, timestampMs, metadata);
  }
}

// Math helpers for Pearson correlation p-value
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function studentTCDF(t: number, df: number): number {
  if (df <= 0) return 0.5;
  if (df === 1) {
    return 0.5 + Math.atan(t) / Math.PI;
  }
  // Normal approximation (Wallace 1959)
  const z = (t * (1 - 1 / (4 * df))) / Math.sqrt(1 + (t * t) / (2 * df));
  return normalCDF(z);
}

function pearsonCorrelation(x: number[], y: number[]): { r: number; p: number } {
  const n = x.length;
  if (n < 3) return { r: 0, p: 1 };

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXSq = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumYSq = y.reduce((sum, yi) => sum + yi * yi, 0);
  const sumXY = x.reduce((sum, xi, idx) => sum + xi * y[idx], 0);

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumXSq - sumX * sumX) * (n * sumYSq - sumY * sumY));

  if (den === 0) return { r: 0, p: 1 };

  const r = num / den;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const df = n - 2;

  // Two-tailed p-value
  const p = 2 * (1 - studentTCDF(Math.abs(t), df));
  return { r, p };
}

export async function computeGazeFluencyCorrelation(
  sessionId: string,
  exchangeId: string,
  wpmSegments: WPMSegment[]
): Promise<number> {
  if (!wpmSegments || wpmSegments.length < 2) {
    return 0.0;
  }

  const db = getDb();

  // Retrieve gaze deviations logged during this exchange
  const events = await db.all(
    'SELECT timestamp_ms FROM integrity_events WHERE session_id = ? AND exchange_id = ? AND event_type IN (?, ?, ?, ?, ?)',
    [
      sessionId,
      exchangeId,
      'gaze_deviation',
      'notes_below_camera',
      'second_monitor_left',
      'second_monitor_right',
      'fixed_reference_point',
    ]
  );

  const deviationPresence: number[] = [];
  const fluencyValues: number[] = [];

  const exchange = await db.get('SELECT created_at FROM exchanges WHERE id = ?', [exchangeId]);
  if (!exchange) {
    return 0.0;
  }

  // Determine starting epoch of the audio
  let dateStr = exchange.created_at;
  if (typeof dateStr === 'string') {
    let normalized = dateStr.trim();
    if (normalized.includes(' ')) {
      normalized = normalized.replace(' ', 'T');
    }
    if (!normalized.endsWith('Z') && !normalized.includes('+') && !normalized.slice(-6).includes('-')) {
      normalized = normalized + 'Z';
    }
    dateStr = normalized;
  }
  let audioStartMs = new Date(dateStr).getTime();

  if (events.length > 0) {
    const oldestEventMs = Math.min(...events.map(e => Number(e.timestamp_ms)));
    if (oldestEventMs < audioStartMs) {
      audioStartMs = oldestEventMs;
    }
  }

  for (const segment of wpmSegments) {
    const segmentStartMs = audioStartMs + Math.round(segment.start * 1000);
    const windowStartMs = segmentStartMs - 5000; // 5 seconds preceding WPM segment
    const windowEndMs = segmentStartMs;

    const deviationsBefore = events.filter(
      e => Number(e.timestamp_ms) >= windowStartMs && Number(e.timestamp_ms) <= windowEndMs
    );

    deviationPresence.push(deviationsBefore.length > 0 ? 1 : 0);
    fluencyValues.push(segment.wpm);
  }

  // Check variance in inputs
  const hasVariance = (arr: number[]) => new Set(arr).size > 1;
  if (!hasVariance(deviationPresence) || !hasVariance(fluencyValues)) {
    console.log('Not enough variance to correlate gaze and fluency');
    return 0.0;
  }

  try {
    const { r, p } = pearsonCorrelation(deviationPresence, fluencyValues);
    if (isNaN(r) || p >= 0.05) {
      return 0.0;
    }
    return r;
  } catch (err) {
    console.error('Error computing Pearson correlation:', err);
    return 0.0;
  }
}

export async function updateIntegrityScore(
  sessionId: string,
  correlation: number,
  exchangeId: string
): Promise<number> {
  const db = getDb();

  const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  if (!session) {
    return 100;
  }

  // Fetch unique event types recorded during the session
  const rows = await db.all('SELECT DISTINCT event_type FROM integrity_events WHERE session_id = ?', [sessionId]);
  const eventTypes = new Set(rows.map(r => r.event_type));

  let deductions = 0;

  // 1. Gaze-fluency correlation deduction
  if (correlation > 0.7) {
    deductions += 25;
    console.warn(`Session ${sessionId}: Strong gaze-fluency correlation (${correlation.toFixed(2)}) -> Deducted 25`);
  } else if (correlation > 0.5) {
    deductions += 12;
    console.warn(`Session ${sessionId}: Moderate gaze-fluency correlation (${correlation.toFixed(2)}) -> Deducted 12`);
  }

  // 2. Event-based deductions (once per unique event type)
  for (const etype of eventTypes) {
    if (etype === 'fixed_reference_point') {
      deductions += 20;
    } else if (etype === 'notes_below_camera') {
      deductions += 15;
    } else if (etype === 'second_monitor_left' || etype === 'second_monitor_right') {
      deductions += 12;
    } else if (etype === 'multiple_faces') {
      deductions += 20;
    } else if (etype === 'voice_mismatch') {
      deductions += 30;
    } else if (etype === 'second_voice_detected') {
      deductions += 25;
    } else if (etype === 'tab_switch' || etype === 'fullscreen_exit') {
      deductions += 15;
    }
  }

  const newScore = Math.max(0, 100 - deductions);

  await db.run('UPDATE sessions SET integrity_score = ? WHERE id = ?', [newScore, sessionId]);
  console.log(`Session ${sessionId} integrity score updated to ${newScore} (deductions=${deductions})`);

  return newScore;
}
