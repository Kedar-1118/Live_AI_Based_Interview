import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { initDb } from './db';
import { app } from './app';
import { decodeToken } from './services/authService';
import { wsManager } from './services/websocketManager';
import { processBehavioralSignal } from './services/integrityEngine';

async function startServer() {
  // Ensure upload directories exist
  fs.mkdirSync(path.join(config.UPLOAD_DIR, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(config.UPLOAD_DIR, 'calibration'), { recursive: true });
  fs.mkdirSync(path.join(config.UPLOAD_DIR, 'temp'), { recursive: true });

  // Initialize SQLite Database
  await initDb();

  // Create HTTP Server
  const server = http.createServer(app);

  // Create WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade to WebSockets manually to parse route parameters & query tokens
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Check path matching "/ws/:session_id"
    if (pathname.startsWith('/ws/')) {
      const sessionId = pathname.split('/')[2];
      const token = url.searchParams.get('token');

      // UUID format validation regex
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!sessionId || !uuidRegex.test(sessionId)) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Authenticate token
      const payload = decodeToken(token);
      if (!payload || payload.type !== 'access') {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // Upgrade the connection
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, sessionId);
      });
    } else {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  });

  // Handle WebSocket Connection
  wss.on('connection', (ws: WebSocket, sessionId: string) => {
    wsManager.connect(sessionId, ws);

    ws.on('message', async (messageData) => {
      try {
        const data = JSON.parse(messageData.toString());

        if (data.type === 'behavioral_signal') {
          const payload = data.payload || {};
          await processBehavioralSignal(sessionId, payload);
        } else if (data.type === 'heartbeat') {
          ws.send(JSON.stringify({ type: 'ack' }));
        } else {
          console.warn(`Unknown WS message type received: ${data.type}`);
        }
      } catch (err) {
        console.error(`Error processing WS message in session ${sessionId}:`, err);
      }
    });

    ws.on('close', () => {
      wsManager.disconnect(sessionId, ws);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error in session ${sessionId}:`, err);
      wsManager.disconnect(sessionId, ws);
    });
  });

  server.listen(config.PORT, () => {
    console.log(`AI Interview Simulator Server is running on port ${config.PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting backend server:', err);
  process.exit(1);
});
