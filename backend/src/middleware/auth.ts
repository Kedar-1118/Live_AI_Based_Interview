import { Request, Response, NextFunction } from 'express';
import { decodeToken } from '../services/authService';
import { getDb } from '../db';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    openai_api_key?: string | null;
    anthropic_api_key?: string | null;
    gemini_api_key?: string | null;
    groq_api_key?: string | null;
    system_key_usage_count: number;
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Not authenticated' });
  }

  const token = authHeader.split(' ')[1];
  const payload = decodeToken(token);

  if (!payload || payload.type !== 'access') {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }

  try {
    const db = getDb();
    const user = await db.get(
      'SELECT id, email, name, openai_api_key, anthropic_api_key, gemini_api_key, groq_api_key, system_key_usage_count FROM users WHERE id = ?',
      [payload.sub]
    );
    if (!user) {
      return res.status(401).json({ detail: 'User not found' });
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ detail: 'Internal server error during authentication' });
  }
}
