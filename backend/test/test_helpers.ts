import { initDb, getDb } from '../src/db';
import { hashPassword } from '../src/services/authService';
import { v4 as uuidv4 } from 'uuid';

export async function initTestDb() {
  await initDb(':memory:');
}

export async function cleanTestDb() {
  const db = getDb();
  await db.close();
}

export async function createTestUser(email: string = 'testuser@example.com', name: string = 'Test User'): Promise<any> {
  const db = getDb();
  const id = uuidv4();
  const passwordHash = hashPassword('password123');
  const createdAt = new Date().toISOString();
  await db.run(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, email, passwordHash, name, createdAt]
  );
  return { id, email, password_hash: passwordHash, name, created_at: createdAt };
}

export async function createTestSession(userId: string, topic: string = 'Machine Learning'): Promise<any> {
  const db = getDb();
  const id = uuidv4();
  const startedAt = new Date().toISOString();
  await db.run(
    `INSERT INTO sessions 
      (id, user_id, topic, difficulty, duration_minutes, status, integrity_score, total_questions, started_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, topic, 'medium', 30, 'active', 100, 5, startedAt]
  );
  return {
    id,
    user_id: userId,
    topic,
    difficulty: 'medium',
    duration_minutes: 30,
    status: 'active',
    integrity_score: 100,
    total_questions: 5,
    started_at: startedAt
  };
}
