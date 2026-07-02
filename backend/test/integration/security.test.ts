import request from 'supertest';
import { app } from '../../src/app';
import { initTestDb, cleanTestDb } from '../test_helpers';
import { createRateLimiter } from '../../src/middleware/rateLimiter';
import express from 'express';

describe('Security and Rate Limiting Integration Tests', () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  test('Response should contain secure HTTP headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
    expect(res.headers['referrer-policy']).toBe('no-referrer-when-downgrade');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('Cookie parser handles malformed URIs safely', async () => {
    // Send a request with a malformed cookie value which would normally throw URIError and crash
    const res = await request(app)
      .get('/health')
      .set('Cookie', 'bad_cookie=%E0%A4%A; good_cookie=value');

    // The request should complete successfully without crashing the process
    expect(res.status).toBe(200);
  });

  test('Custom Rate Limiter middleware blocks excessive requests', async () => {
    const testApp = express();
    const limiter = createRateLimiter({
      windowMs: 5000,
      max: 3,
      message: 'Too many requests'
    });

    testApp.get('/test', limiter, (req, res) => {
      res.json({ ok: true });
    });

    // Make 3 requests (allowed)
    await request(testApp).get('/test').expect(200);
    await request(testApp).get('/test').expect(200);
    await request(testApp).get('/test').expect(200);

    // 4th request should be blocked (429)
    const res = await request(testApp).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.detail).toBe('Too many requests');
  });

  test('POST /sessions/create rejects invalid parameters', async () => {
    // Register & Login to get token
    await request(app)
      .post('/auth/register')
      .send({ email: 'sec@example.com', password: 'password123', name: 'Sec User' });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'sec@example.com', password: 'password123' });

    const token = loginRes.body.access_token;

    // 1. Invalid difficulty
    let res = await request(app)
      .post('/sessions/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'ML', difficulty: 'invalid_diff' });
    expect(res.status).toBe(400);

    // 2. Invalid total_questions (out of bounds)
    res = await request(app)
      .post('/sessions/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'ML', total_questions: 100 });
    expect(res.status).toBe(400);

    // 3. Invalid duration (too short)
    res = await request(app)
      .post('/sessions/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'ML', duration_minutes: 2 });
    expect(res.status).toBe(400);

    // 4. Invalid provider
    res = await request(app)
      .post('/sessions/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'ML', llm_provider: 'unsupported_llm' });
    expect(res.status).toBe(400);

    // 5. Empty topic
    res = await request(app)
      .post('/sessions/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: '', total_questions: 5 });
    expect(res.status).toBe(400);
  });

  test('POST /answers/submit rejects overly long answers', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'sec2@example.com', password: 'password123', name: 'Sec User 2' });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'sec2@example.com', password: 'password123' });

    const token = loginRes.body.access_token;

    // Create session
    const sessionRes = await request(app)
      .post('/sessions/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'DSA', total_questions: 3 });

    const sessionId = sessionRes.body.id;

    // Overly long text (> 5000 chars)
    const longText = 'a'.repeat(5001);

    const res = await request(app)
      .post('/answers/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ session_id: sessionId, answer_text: longText });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('exceeds maximum allowed length');
  });

  test('POST /answers/submit-audio rejects files with non-audio mimetypes', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'sec3@example.com', password: 'password123', name: 'Sec User 3' });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'sec3@example.com', password: 'password123' });

    const token = loginRes.body.access_token;

    // Create session
    const sessionRes = await request(app)
      .post('/sessions/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'DSA', total_questions: 3 });

    const sessionId = sessionRes.body.id;

    // Upload a dummy text file with mimetype 'text/plain', simulating malicious file
    const res = await request(app)
      .post('/answers/submit-audio')
      .set('Authorization', `Bearer ${token}`)
      .field('session_id', sessionId)
      .attach('audio', Buffer.from('malicious payload content'), {
        filename: 'exploit.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('Only audio uploads are permitted');
  });
});
