import request from 'supertest';
import { app } from '../../src/app';
import { getDb } from '../../src/db';
import { initTestDb, cleanTestDb, createTestUser, createTestSession } from '../test_helpers';
import { createAccessToken } from '../../src/services/authService';
import { v4 as uuidv4 } from 'uuid';

describe('Answers Router Integration Tests', () => {
  let user: any;
  let token: string;
  let authHeaders: Record<string, string>;
  let session: any;
  let exchangeId: string;

  beforeEach(async () => {
    await initTestDb();
    const db = getDb();
    
    user = await createTestUser();
    // Enable mock OpenAI API keys for user context so aiProvider won't reject or call external API
    await db.run(
      'UPDATE users SET openai_api_key = ?, anthropic_api_key = ? WHERE id = ?',
      ['mock', 'mock', user.id]
    );
    user.openai_api_key = 'mock';
    user.anthropic_api_key = 'mock';

    token = createAccessToken(user.id);
    authHeaders = { Authorization: `Bearer ${token}` };

    session = await createTestSession(user.id);
    exchangeId = uuidv4();
    const startedAt = new Date().toISOString();
    await db.run(
      'INSERT INTO exchanges (id, session_id, question, question_index, created_at) VALUES (?, ?, ?, ?, ?)',
      [exchangeId, session.id, 'What is unsupervised learning?', 1, startedAt]
    );
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  test('POST /answers/submit success', async () => {
    const res = await request(app)
      .post('/answers/submit')
      .set(authHeaders)
      .send({
        session_id: session.id,
        answer_text: 'Unsupervised learning finds patterns in unlabeled data.',
      });

    expect(res.status).toBe(200);
    expect(res.body.exchange_id).toBe(exchangeId);
    expect(res.body).toHaveProperty('evaluation');
    expect(res.body.evaluation).toHaveProperty('technical_accuracy');
    expect(res.body.question_index).toBe(1);
  });

  test('POST /answers/submit-audio success', async () => {
    // Prepare dummy WAV data
    const dummyAudio = Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x40\x1f\x00\x00\x40\x1f\x00\x00\x01\x00\x08\x00data\x00\x00\x00\x00');

    const res = await request(app)
      .post('/answers/submit-audio')
      .set(authHeaders)
      .attach('audio', dummyAudio, { filename: 'test.wav', contentType: 'audio/wav' })
      .field('session_id', session.id);

    expect(res.status).toBe(200);
    expect(res.body.exchange_id).toBe(exchangeId);
    expect(res.body).toHaveProperty('transcript');
    expect(res.body).toHaveProperty('speech_analysis');
    expect(res.body.speech_analysis).toHaveProperty('avg_wpm');
  });

  test('POST /answers/submit no active question', async () => {
    // Create another session with no unanswered exchanges
    const sessionNoQ = await createTestSession(user.id);

    const res = await request(app)
      .post('/answers/submit')
      .set(authHeaders)
      .send({
        session_id: sessionNoQ.id,
        answer_text: 'Random answer',
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('No pending question found');
  });
});
