import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function createAccessToken(userId: string): string {
  const expirySeconds = config.ACCESS_TOKEN_EXPIRE_MINUTES * 60;
  return jwt.sign(
    {
      sub: userId,
      type: 'access',
    },
    config.JWT_SECRET,
    {
      algorithm: config.JWT_ALGORITHM as jwt.Algorithm || 'HS256',
      expiresIn: expirySeconds,
    }
  );
}

export function createRefreshToken(userId: string): string {
  const expirySeconds = config.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60;
  return jwt.sign(
    {
      sub: userId,
      type: 'refresh',
    },
    config.JWT_SECRET,
    {
      algorithm: config.JWT_ALGORITHM as jwt.Algorithm || 'HS256',
      expiresIn: expirySeconds,
    }
  );
}

export function decodeToken(token: string): any {
  try {
    return jwt.verify(token, config.JWT_SECRET, {
      algorithms: [config.JWT_ALGORITHM as jwt.Algorithm || 'HS256'],
    });
  } catch (err) {
    return null;
  }
}
