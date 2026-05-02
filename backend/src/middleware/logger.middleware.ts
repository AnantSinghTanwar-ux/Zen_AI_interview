import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from '../config/logger';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'jwt',
]);

function sanitizeForLogs(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  try {
    const clone = Array.isArray(value) ? [...value] : { ...(value as Record<string, unknown>) };

    if (Array.isArray(clone)) return clone.slice(0, 50);

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(clone as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k) || SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '***';
      } else {
        out[k] = v;
      }
    }

    // Prevent extremely large payloads from spamming logs.
    const str = JSON.stringify(out);
    if (str.length > 20_000) return '[omitted: body too large]';
    return out;
  } catch {
    return '[unserializable body]';
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = randomUUID();
  (req as unknown as { requestId?: string }).requestId = requestId;

  // Reduce noise for health checks (optional)
  if (req.originalUrl === '/api/v1/health') return next();

  const start = Date.now();
  const startBody = (req as unknown as { body?: unknown }).body;

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    const shouldLogBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && startBody;

    logger.log(level, 'HTTP Request', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${durationMs}ms`,
      userId: req.user?.userId || null,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      body: shouldLogBody ? sanitizeForLogs(startBody) : undefined,
    });

    if (durationMs > 1000) {
      logger.warn('Slow Request', {
        requestId,
        url: req.originalUrl,
        duration: `${durationMs}ms`,
        status: res.statusCode,
      });
    }
  });

  next();
};

