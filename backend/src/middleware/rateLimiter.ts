import { Request, Response, NextFunction } from 'express';

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;
  const requests = new Map<string, number[]>();

  // Periodically clean up stale IP records to avoid memory leaks
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const active = timestamps.filter(ts => now - ts < windowMs);
      if (active.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, active);
      }
    }
  }, Math.max(windowMs, 60000));

  // Unref the timer so it doesn't prevent Node or Jest from exiting
  if (interval && typeof interval.unref === 'function') {
    interval.unref();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let timestamps = requests.get(ip) || [];
    
    // Filter out timestamps outside the sliding window
    timestamps = timestamps.filter(ts => now - ts < windowMs);

    if (timestamps.length >= max) {
      return res.status(429).json({ detail: message });
    }

    timestamps.push(now);
    requests.set(ip, timestamps);
    next();
  };
}

// 1. General Limit: Max 500 requests per 15 minutes
export const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests from this IP. Please try again after 15 minutes.'
});

// 2. Auth Limit: Max 15 request attempts (login/register/refresh) per 1 minute
export const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts. Please try again after a minute.'
});

// 3. LLM Action Limit: Max 20 calls to create sessions or submit answers per 5 minutes
export const llmLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'AI interface rate limit exceeded. Please wait 5 minutes before trying again.'
});
