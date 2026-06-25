import request from 'supertest';
import http from 'http';
import { WebSocketServer, WebSocket as WSClient } from 'ws';
import { app } from '../../src/app';
import { getDb } from '../../src/db';
import { initTestDb, cleanTestDb, createTestUser, createTestSession } from '../test_helpers';
import { createAccessToken } from '../../src/services/authService';
import { decodeToken } from '../../src/services/authService';
import { wsManager } from '../../src/services/websocketManager';
import { processBehavioralSignal } from '../../src/services/integrityEngine';
import { AddressInfo } from 'net';

describe('WebSocket Integration Tests', () => {
  let user: any;
  let token: string;
  let session: any;
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    await initTestDb();
    const db = getDb();
    user = await createTestUser();
    token = createAccessToken(user.id);
    session = await createTestSession(user.id);

    // Create the test HTTP server and upgrade logic identical to index.ts
    server = http.createServer(app);
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const pathname = url.pathname;

      if (pathname.startsWith('/ws/')) {
        const sessionId = pathname.split('/')[2];
        const tokenParam = url.searchParams.get('token');

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!sessionId || !uuidRegex.test(sessionId)) {
          socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
          socket.destroy();
          return;
        }

        if (!tokenParam) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        const payload = decodeToken(tokenParam);
        if (!payload || payload.type !== 'access') {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, sessionId);
        });
      } else {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      }
    });

    wss.on('connection', (ws: any, sessionId: string) => {
      wsManager.connect(sessionId, ws);
      ws.on('message', async (messageData: any) => {
        try {
          const data = JSON.parse(messageData.toString());
          if (data.type === 'behavioral_signal') {
            await processBehavioralSignal(sessionId, data.payload || {});
          } else if (data.type === 'heartbeat') {
            ws.send(JSON.stringify({ type: 'ack' }));
          }
        } catch (err) {}
      });
      ws.on('close', () => wsManager.disconnect(sessionId));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        port = addr.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Disconnect any active wsManager connections
    wsManager.disconnect(session.id);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanTestDb();
  });

  test('ws connection rejected with invalid UUID session ID', async () => {
    const ws = new WSClient(`ws://localhost:${port}/ws/not-a-uuid?token=dummy`);
    
    const errorPromise = new Promise<Error>((resolve) => {
      ws.on('error', (err) => resolve(err));
    });

    const err = await errorPromise;
    expect(err.message).toContain('Unexpected server response: 400');
  });

  test('ws connection rejected with missing token', async () => {
    const ws = new WSClient(`ws://localhost:${port}/ws/${session.id}`);

    const errorPromise = new Promise<Error>((resolve) => {
      ws.on('error', (err) => resolve(err));
    });

    const err = await errorPromise;
    expect(err.message).toContain('Unexpected server response: 401');
  });

  test('ws connection rejected with invalid token', async () => {
    const ws = new WSClient(`ws://localhost:${port}/ws/${session.id}?token=invalidtoken`);

    const errorPromise = new Promise<Error>((resolve) => {
      ws.on('error', (err) => resolve(err));
    });

    const err = await errorPromise;
    expect(err.message).toContain('Unexpected server response: 403');
  });

  test('ws connection success and heartbeat', async () => {
    const ws = new WSClient(`ws://localhost:${port}/ws/${session.id}?token=${token}`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', (err) => reject(err));
    });

    ws.send(JSON.stringify({ type: 'heartbeat' }));

    const message = await new Promise<string>((resolve) => {
      ws.on('message', (data) => resolve(data.toString()));
    });

    expect(JSON.parse(message)).toEqual({ type: 'ack' });
    ws.close();
  });

  test('ws behavioral signal streaming', async () => {
    const db = getDb();
    // Add baseline to avoid early exit during processing
    const baselineId = '../../src/services/baselineId';
    await db.run(
      `INSERT INTO baselines 
        (id, session_id, avg_wpm, wpm_std_dev, gaze_center_x, gaze_center_y, gaze_std_dev, head_pose_range) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['baseline-123', session.id, 150.0, 15.0, 0.5, 0.5, 0.1, JSON.stringify({ yaw: [-10, 10], pitch: [-10, 10] })]
    );

    const ws = new WSClient(`ws://localhost:${port}/ws/${session.id}?token=${token}`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', (err) => reject(err));
    });

    ws.send(
      JSON.stringify({
        type: 'behavioral_signal',
        payload: {
          face_count: 0,
          timestamp: Date.now(),
        },
      })
    );

    // Wait a brief moment for signal processing asynchronously
    await new Promise<void>((resolve) => setTimeout(resolve, 300));

    // Verify event in DB
    const events = await db.all('SELECT * FROM integrity_events WHERE session_id = ?', [session.id]);
    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe('face_missing');

    ws.close();
  });
});
