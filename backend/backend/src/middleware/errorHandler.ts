import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import logger from '../config/logger';

type AnyError = AppError | (Error & { statusCode?: number; isOperational?: boolean });

function sanitizeForLogs(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  const sensitive = new Set([
    'password',
    'token',
    'refreshToken',
    'accessToken',
    'authorization',
    'jwt',
  ]);

  try {
    const clone = Array.isArray(value) ? [...value] : { ...(value as Record<string, unknown>) };
    if (Array.isArray(clone)) return clone.slice(0, 50);

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(clone as Record<string, unknown>)) {
      if (sensitive.has(k) || sensitive.has(k.toLowerCase())) out[k] = '***';
      else out[k] = v;
    }
    const str = JSON.stringify(out);
    if (str.length > 20_000) return '[omitted: body too large]';
    return out;
  } catch {
    return '[unserializable body]';
  }
}

export const errorHandler = (
  err: AnyError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const anyErr = err as unknown as Record<string, unknown>;
  let statusCode = 500;
  let isOperational = false;
  let message = 'Internal server error';
  let errorCode: string | undefined;
  let details: unknown;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    isOperational = err.isOperational;
    message = err.message;
    errorCode = err.code;
    details = (err as unknown as { details?: unknown }).details;
  } else {
    // If a raw Error was thrown with a `statusCode`, treat it as operational so we preserve its payload.
    const rawStatusCode = typeof anyErr.statusCode === 'number' ? anyErr.statusCode : 500;
    statusCode = rawStatusCode;
    isOperational = anyErr.statusCode !== undefined;
    message = isOperational ? err.message : 'Internal server error';
    const maybeErrorCode = anyErr.error ?? anyErr.code;
    if (typeof maybeErrorCode === 'string') errorCode = maybeErrorCode;
    if (anyErr.details !== undefined) details = anyErr.details;
  }

  // Normalize common DB/driver errors.
  // Postgres unique violation: https://www.postgresql.org/docs/current/errcodes-appendix.html
  if (!(err instanceof AppError) && anyErr.code === '23505') {
    statusCode = 409;
    isOperational = true;
    message = 'Resource already exists';
    errorCode = 'DUPLICATE_ENTRY';
  }

  // Normalize JWT errors when they bubble up to the handler.
  if (!(err instanceof AppError) && typeof anyErr.name === 'string') {
    if (anyErr.name === 'JsonWebTokenError') {
      statusCode = 401;
      isOperational = true;
      message = 'Invalid token';
      errorCode = 'INVALID_TOKEN';
    } else if (anyErr.name === 'TokenExpiredError') {
      statusCode = 401;
      isOperational = true;
      message = 'Token expired';
      errorCode = 'TOKEN_EXPIRED';
    } else if (anyErr.name === 'MulterError') {
      statusCode = 400;
      isOperational = true;
      const multerCode = typeof anyErr.code === 'string' ? anyErr.code : 'MULTER_ERROR';
      errorCode = multerCode;
      if (multerCode === 'LIMIT_FILE_SIZE') {
        message = 'Uploaded file is too large';
      } else {
        message = err.message || 'Invalid upload payload';
      }
    }
  }

  // Metrics hook (placeholder) — replace with Prometheus/StatsD later.
  if (errorCode) {
    // eslint-disable-next-line no-unused-expressions
    errorCode;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error]', err.message, err.stack);
  }

  const requestId = (req as unknown as { requestId?: string }).requestId || null;
  const safeBody = sanitizeForLogs((req as unknown as { body?: unknown }).body);

  logger.error('Unhandled Error', {
    requestId,
    message: err.message,
    stack: (err as unknown as { stack?: string }).stack,
    url: req.originalUrl,
    method: req.method,
    userId: (req as unknown as { user?: { userId?: string } }).user?.userId || null,
    statusCode,
    errorCode: errorCode ?? null,
    body: safeBody,
    userAgent: req.headers['user-agent'],
  });

  const response: Record<string, unknown> = {
    success: false,
    error: errorCode ?? (isOperational ? 'ERROR' : 'INTERNAL_ERROR'),
    message,
  };

  if (isOperational) {
    if (anyErr.required !== undefined) response.required = anyErr.required;
    if (anyErr.available !== undefined) response.available = anyErr.available;
  }
  if (details !== undefined) response.details = details;
  if (anyErr.errors !== undefined) response.errors = anyErr.errors;

  if (process.env.NODE_ENV === 'development') response.stack = (err as unknown as { stack?: string }).stack;

  res.status(statusCode).json(response);
};

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
};
