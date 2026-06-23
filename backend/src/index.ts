import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { initDb } from './db';
import authRouter from './routes/auth';
import sessionsRouter from './routes/sessions';
import answersRouter from './routes/answers';
import usersRouter from './routes/users';
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

  const app = express();
  
  // Custom minimal cookie parser middleware (avoids extra dependency)
  app.use((req: any, res, next) => {
    const list: Record<string, string> = {};
    const rc = req.headers.cookie;

    if (rc) {
      rc.split(';').forEach((cookie: string) => {
        const parts = cookie.split('=');
        const key = parts.shift()?.trim();
        if (key) {
          list[key] = decodeURIComponent(parts.join('='));
        }
      });
    }

    req.cookies = list;
    next();
  });

  // CORS middleware
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or local scripts)
        if (!origin || config.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    })
  );

  app.use(express.json());

  // Static files server for audio uploads
  app.use('/uploads', express.static(config.UPLOAD_DIR));

  // REST API Routes
  app.use('/auth', authRouter);
  app.use('/sessions', sessionsRouter);
  app.use('/answers', answersRouter);
  app.use('/users', usersRouter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    return res.json({ status: 'healthy', app: config.APP_NAME });
  });

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
      wsManager.disconnect(sessionId);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error in session ${sessionId}:`, err);
      wsManager.disconnect(sessionId);
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
