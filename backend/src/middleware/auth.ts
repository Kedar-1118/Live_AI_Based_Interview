import { Request, Response, NextFunction } from 'express';
import { decodeToken } from '../services/authService';
import { getDb } from '../db';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
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
    const user = await db.get('SELECT id, email, name FROM users WHERE id = ?', [payload.sub]);
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
