import { getDb } from '../../src/db';
import { initTestDb, cleanTestDb, createTestUser, createTestSession } from '../test_helpers';
import {
  processBehavioralSignal,
  computeGazeFluencyCorrelation,
  updateIntegrityScore,
} from '../../src/services/integrityEngine';
import { WPMSegment } from '../../src/services/speechAnalyzer';
import { v4 as uuidv4 } from 'uuid';

describe('IntegrityEngine Unit Tests', () => {
  let user: any;
  let session: any;
  let exchangeId: string;

  beforeEach(async () => {
    await initTestDb();
    const db = getDb();
    user = await createTestUser();
    session = await createTestSession(user.id);

    // Create an active exchange
    exchangeId = uuidv4();
    const startedAt = new Date().toISOString();
    await db.run(
      'INSERT INTO exchanges (id, session_id, question, question_index, created_at) VALUES (?, ?, ?, ?, ?)',
      [exchangeId, session.id, 'What is regular expression?', 1, startedAt]
    );

    // Create baseline
    const baselineId = uuidv4();
    await db.run(
      `INSERT INTO baselines 
        (id, session_id, avg_wpm, wpm_std_dev, gaze_center_x, gaze_center_y, gaze_std_dev, head_pose_range) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [baselineId, session.id, 150.0, 15.0, 0.5, 0.5, 0.1, JSON.stringify({ yaw: [-10, 10], pitch: [-10, 10] })]
    );
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  test('processBehavioralSignal custom event', async () => {
    const db = getDb();
    const signal = {
      event_type: 'tab_switch',
      severity: 'medium',
      metadata: { message: 'User Alt-Tabbed' },
      timestamp: Date.now(),
    };

    await processBehavioralSignal(session.id, signal);

    // Verify event logged in DB
    const evts = await db.all('SELECT * FROM integrity_events WHERE session_id = ?', [session.id]);
    expect(evts.length).toBe(1);
    expect(evts[0].event_type).toBe('tab_switch');
    expect(evts[0].severity).toBe('medium');
  });

  test('processBehavioralSignal face missing', async () => {
    const db = getDb();
    const signal = {
      face_count: 0,
      timestamp: Date.now(),
    };

    await processBehavioralSignal(session.id, signal);

    const evts = await db.all("SELECT * FROM integrity_events WHERE event_type = 'face_missing'");
    expect(evts.length).toBe(1);
  });

  test('processBehavioralSignal multiple faces', async () => {
    const db = getDb();
    const signal = {
      face_count: 2,
      timestamp: Date.now(),
    };

    await processBehavioralSignal(session.id, signal);

    const evts = await db.all("SELECT * FROM integrity_events WHERE event_type = 'multiple_faces'");
    expect(evts.length).toBe(1);
  });

  test('processBehavioralSignal gaze deviation', async () => {
    const db = getDb();
    const now = Date.now();
    
    // Send 5 signals deviating to the right (x > 0.85) over 4 seconds
    for (let i = 0; i < 5; i++) {
      const signal = {
        face_count: 1,
        gaze: { x: 0.9, y: 0.5 },
        head_pose: { yaw: 5.0, pitch: 0.0 },
        timestamp: now - (4000 - i * 1000),
      };
      await processBehavioralSignal(session.id, signal);
    }

    const evts = await db.all("SELECT * FROM integrity_events WHERE event_type = 'second_monitor_right'");
    expect(evts.length).toBe(1);
  });

  test('computeGazeFluencyCorrelation positive correlation', async () => {
    const db = getDb();
    const startedAt = new Date().toISOString();
    const audioStart = new Date(startedAt + ' Z').getTime();

    // Log gaze deviation events in DB
    const id1 = uuidv4();
    const id2 = uuidv4();
    await db.run(
      'INSERT INTO integrity_events (id, session_id, exchange_id, event_type, severity, timestamp_ms) VALUES (?, ?, ?, ?, ?, ?)',
      [id1, session.id, exchangeId, 'gaze_deviation', 'low', audioStart + 1000]
    );
    await db.run(
      'INSERT INTO integrity_events (id, session_id, exchange_id, event_type, severity, timestamp_ms) VALUES (?, ?, ?, ?, ?, ?)',
      [id2, session.id, exchangeId, 'gaze_deviation', 'low', audioStart + 7000]
    );

    // Create WPM segments
    const wpmSegs: WPMSegment[] = [
      { start: 3.0, end: 4.0, wpm: 160.0, word_count: 10 },
      { start: 10.0, end: 11.0, wpm: 170.0, word_count: 10 },
      { start: 25.0, end: 26.0, wpm: 100.0, word_count: 10 },
    ];

    // Gaze events (1 inside window [3-5s, i.e. 0-3s], 1 inside window [10-5s, i.e. 5-10s])
    // Segment 1 start is 3.0s (3000ms). Preceding window is [-2000ms, 3000ms]. Event at +1000ms matches.
    // Segment 2 start is 10.0s (10000ms). Preceding window is [5000ms, 10000ms]. Event at +7000ms matches.
    // Segment 3 start is 25.0s (25000ms). Preceding window is [20000ms, 25000ms]. No events.
    // deviationPresence: [1, 1, 0]
    // fluencyValues: [160, 170, 100]

    const correlation = await computeGazeFluencyCorrelation(session.id, exchangeId, wpmSegs);

    expect(typeof correlation).toBe('number');
    expect(correlation).toBeGreaterThan(0.0);
  });

  test('updateIntegrityScore checks deductions', async () => {
    const db = getDb();

    // Log two events
    const id1 = uuidv4();
    const id2 = uuidv4();
    await db.run(
      'INSERT INTO integrity_events (id, session_id, event_type, severity, timestamp_ms) VALUES (?, ?, ?, ?, ?)',
      [id1, session.id, 'tab_switch', 'medium', Date.now()]
    );
    await db.run(
      'INSERT INTO integrity_events (id, session_id, event_type, severity, timestamp_ms) VALUES (?, ?, ?, ?, ?)',
      [id2, session.id, 'notes_below_camera', 'medium', Date.now()]
    );

    // Update score with correlation = 0.6
    // Deductions:
    // - correlation > 0.5: -12
    // - tab_switch: -15
    // - notes_below_camera: -15
    // Total deductions = 42 => integrity score = 58
    const newScore = await updateIntegrityScore(session.id, 0.6, exchangeId);

    expect(newScore).toBe(58);

    // Check persistence
    const sess = await db.get('SELECT integrity_score FROM sessions WHERE id = ?', [session.id]);
    expect(sess.integrity_score).toBe(58);
  });
});
