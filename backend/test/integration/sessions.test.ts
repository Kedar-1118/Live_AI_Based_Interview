import request from 'supertest';
import { app } from '../../src/app';
import { getDb } from '../../src/db';
import { initTestDb, cleanTestDb, createTestUser, createTestSession } from '../test_helpers';
import { createAccessToken } from '../../src/services/authService';
import { v4 as uuidv4 } from 'uuid';

describe('Sessions Router Integration Tests', () => {
  let user: any;
  let token: string;
  let authHeaders: Record<string, string>;

  beforeEach(async () => {
    await initTestDb();
    user = await createTestUser();
    token = createAccessToken(user.id);
    authHeaders = { Authorization: `Bearer ${token}` };
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  test('POST /sessions/create', async () => {
    const res = await request(app)
      .post('/sessions/create')
      .set(authHeaders)
      .send({
        topic: 'Machine Learning',
        difficulty: 'medium',
        duration_minutes: 30,
        total_questions: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body.topic).toBe('Machine Learning');
    expect(res.body.status).toBe('active');
    expect(res.body.exchanges.length).toBe(1);
    expect(res.body.exchanges[0].question_index).toBe(1);
  });

  test('GET /sessions/:id', async () => {
    const session = await createTestSession(user.id);

    const res = await request(app)
      .get(`/sessions/${session.id}`)
      .set(authHeaders);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(session.id);
    expect(res.body.topic).toBe('Machine Learning');
  });

  test('GET /sessions/:id not found', async () => {
    const randomId = uuidv4();
    const res = await request(app)
      .get(`/sessions/${randomId}`)
      .set(authHeaders);

    expect(res.status).toBe(404);
  });

  test('PATCH /sessions/:id/end', async () => {
    const session = await createTestSession(user.id);

    const res = await request(app)
      .patch(`/sessions/${session.id}/end`)
      .set(authHeaders);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  test('POST /sessions/:id/calibration/complete & GET baseline', async () => {
    const session = await createTestSession(user.id);

    // Complete calibration
    const resComplete = await request(app)
      .post(`/sessions/${session.id}/calibration/complete`)
      .set(authHeaders)
      .send({
        avg_wpm: 140.5,
        wpm_std_dev: 12.0,
        gaze_center_x: 0.52,
        gaze_center_y: 0.48,
        gaze_std_dev: 0.08,
        head_pose_range: {
          yaw: [-12.0, 11.5],
          pitch: [-8.0, 9.0],
        },
      });

    expect(resComplete.status).toBe(200);
    expect(resComplete.body.status).toBe('success');

    // Retrieve baseline
    const resBaseline = await request(app)
      .get(`/sessions/${session.id}/baseline`)
      .set(authHeaders);

    expect(resBaseline.status).toBe(200);
    expect(resBaseline.body.avg_wpm).toBe(140.5);
    expect(resBaseline.body.gaze_center_x).toBe(0.52);
  });

  test('GET /sessions/:id/report', async () => {
    const session = await createTestSession(user.id);

    const res = await request(app)
      .get(`/sessions/${session.id}/report`)
      .set(authHeaders);

    expect(res.status).toBe(200);
    expect(res.body.session_id).toBe(session.id);
    expect(res.body.integrity_score).toBe(100);
    expect(res.body.verdict).toBe('EXCELLENT');
  });
});
