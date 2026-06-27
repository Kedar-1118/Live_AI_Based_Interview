import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { hashPassword, verifyPassword, createAccessToken, createRefreshToken, decodeToken } from '../services/authService';

const router = Router();

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required' });
  }

  try {
    const db = getDb();
    
    // Check if email already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ detail: 'Email already registered' });
    }

    const userId = uuidv4();
    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();

    await db.run(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, email, passwordHash, name || null, createdAt]
    );

    const accessToken = createAccessToken(userId);
    const refreshToken = createRefreshToken(userId);

    // Set refresh token cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, // Set true in production with HTTPS
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const user = {
      id: userId,
      email,
      name: name || null,
      created_at: createdAt
    };

    return res.status(201).json({
      access_token: accessToken,
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ detail: 'Internal server error during registration' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required' });
  }

  try {
    const db = getDb();

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ detail: 'Invalid email or password' });
    }

    const accessToken = createAccessToken(user.id);
    const refreshToken = createRefreshToken(user.id);

    // Set refresh token cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, // Set true in production with HTTPS
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ detail: 'Internal server error during login' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ detail: 'Missing refresh token' });
  }

  const payload = decodeToken(refreshToken);
  if (!payload || payload.type !== 'refresh') {
    return res.status(401).json({ detail: 'Invalid or expired refresh token' });
  }

  try {
    const db = getDb();
    const user = await db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [payload.sub]);
    if (!user) {
      return res.status(401).json({ detail: 'User not found' });
    }

    const accessToken = createAccessToken(user.id);

    return res.json({
      access_token: accessToken,
      user
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ detail: 'Internal server error during token refresh' });
  }
});

// POST /auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('refresh_token');
  return res.json({ message: 'Logged out successfully' });
});

export default router;
