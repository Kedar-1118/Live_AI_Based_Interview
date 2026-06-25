import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  decodeToken,
} from '../../src/services/authService';
import { v4 as uuidv4 } from 'uuid';

describe('AuthService Unit Tests', () => {
  test('password hashing and verification', () => {
    const password = 'mysecurepassword';
    const hashed = hashPassword(password);

    expect(hashed).not.toBe(password);
    expect(verifyPassword(password, hashed)).toBe(true);
    expect(verifyPassword('wrongpassword', hashed)).toBe(false);
  });

  test('token creation and decoding', () => {
    const userId = uuidv4();

    // Test Access Token
    const accessToken = createAccessToken(userId);
    const payload = decodeToken(accessToken);

    expect(payload).not.toBeNull();
    expect(payload.sub).toBe(userId);
    expect(payload.type).toBe('access');
    expect(payload).toHaveProperty('exp');

    // Test Refresh Token
    const refreshToken = createRefreshToken(userId);
    const payloadRefresh = decodeToken(refreshToken);

    expect(payloadRefresh).not.toBeNull();
    expect(payloadRefresh.sub).toBe(userId);
    expect(payloadRefresh.type).toBe('refresh');
  });

  test('decode invalid token', () => {
    expect(decodeToken('invalid.token.string')).toBeNull();
    expect(decodeToken('')).toBeNull();
  });
});
