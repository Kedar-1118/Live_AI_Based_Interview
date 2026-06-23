import dotenv from 'dotenv';
import path from 'path';

// Load .env from the project root (two levels up from backend/src/config.ts)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

export const config = {
  DATABASE_URL: process.env.DATABASE_URL || 'sqlite:./interview.db',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-to-a-random-secret-in-production',
  JWT_ALGORITHM: process.env.JWT_ALGORITHM || 'HS256',
  ACCESS_TOKEN_EXPIRE_MINUTES: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '15', 10),
  REFRESH_TOKEN_EXPIRE_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS || '7', 10),
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
  DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER || 'anthropic',
  DEFAULT_LLM_MODEL: process.env.DEFAULT_LLM_MODEL || 'claude-sonnet-4-20250514',
  SYSTEM_KEY_USAGE_LIMIT: parseInt(process.env.SYSTEM_KEY_USAGE_LIMIT || '30', 10),
  UPLOAD_DIR: path.resolve(__dirname, '..', 'uploads'),
  MAX_AUDIO_SIZE_MB: parseInt(process.env.MAX_AUDIO_SIZE_MB || '25', 10),
  APP_NAME: 'AI Interview Simulator',
  DEBUG: process.env.DEBUG !== 'false',
  PORT: parseInt(process.env.PORT || '8000', 10),
  CORS_ORIGINS: ['http://localhost:5173', 'http://localhost:3000']
};

export default config;
