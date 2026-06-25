import request from 'supertest';
import { app } from '../../src/app';
import { getDb } from '../../src/db';
import { initTestDb, cleanTestDb } from '../test_helpers';

describe('Auth Router Integration Tests', () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(async () => {
    await cleanTestDb();
  });

  test('POST /auth/register success', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body.user.email).toBe('newuser@example.com');
    expect(res.body.user.name).toBe('New User');
  });

  test('POST /auth/register duplicate email', async () => {
    // Register first user
    await request(app)
      .post('/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'password123',
        name: 'User One',
      });

    // Register second user with same email
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'anotherpassword',
        name: 'User Two',
      });

    expect(res.status).toBe(409);
    expect(res.body.detail).toContain('Email already registered');
  });

  test('POST /auth/login success', async () => {
    // Register user first
    await request(app)
      .post('/auth/register')
      .send({
        email: 'loginuser@example.com',
        password: 'correctpassword',
        name: 'Login User',
      });

    // Login
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'loginuser@example.com',
        password: 'correctpassword',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    
    // Verify cookie is set
    const cookieHeader = res.headers['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : (cookieHeader ? [cookieHeader] : []);
    const hasRefreshToken = cookies.some((c: string) => c.includes('refresh_token'));
    expect(hasRefreshToken).toBe(true);
  });

  test('POST /auth/login invalid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'somepassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.detail).toContain('Invalid email or password');
  });

  test('POST /auth/logout', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');
  });
});
