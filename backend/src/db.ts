import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database;

export async function initDb() {
  db = await open({
    filename: path.resolve(__dirname, '..', 'interview.db'),
    driver: sqlite3.Database
  });

  // Enable foreign keys support in SQLite
  await db.run('PRAGMA foreign_keys = ON');

  // Create tables if they do not exist (development/first run support)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      difficulty TEXT DEFAULT 'medium',
      duration_minutes INTEGER DEFAULT 30,
      status TEXT DEFAULT 'active',
      integrity_score INTEGER DEFAULT 100,
      total_questions INTEGER DEFAULT 10,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS exchanges (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer_transcript TEXT,
      question_index INTEGER NOT NULL,
      embedding TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      exchange_id TEXT UNIQUE NOT NULL,
      technical_accuracy INTEGER,
      definition_present BOOLEAN,
      mechanism_explained BOOLEAN,
      example_given BOOLEAN,
      edge_cases_mentioned BOOLEAN,
      missing_concepts TEXT,
      follow_up_angle TEXT,
      wpm INTEGER,
      filler_count INTEGER,
      longest_pause_seconds REAL,
      confidence_proxy REAL,
      gaze_fluency_correlation REAL,
      FOREIGN KEY (exchange_id) REFERENCES exchanges(id)
    );

    CREATE TABLE IF NOT EXISTS integrity_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      exchange_id TEXT,
      event_type TEXT NOT NULL,
      severity TEXT,
      timestamp_ms BIGINT,
      metadata_json TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (exchange_id) REFERENCES exchanges(id)
    );

    CREATE TABLE IF NOT EXISTS weak_topics (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      avg_score REAL,
      occurrence INTEGER DEFAULT 1,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS baselines (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      avg_wpm REAL,
      wpm_std_dev REAL,
      gaze_center_x REAL,
      gaze_center_y REAL,
      gaze_std_dev REAL,
      head_pose_range TEXT,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);

  console.log('SQLite database tables initialized successfully.');
  return db;
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized! Call initDb() first.');
  }
  return db;
}
