import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRouter from './routes/auth';
import sessionsRouter from './routes/sessions';
import answersRouter from './routes/answers';
import usersRouter from './routes/users';

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

export { app };
export default app;
