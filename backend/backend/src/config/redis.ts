import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  // Don't connect on import; connect explicitly at runtime when needed.
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

let hasLoggedRedisError = false;
redis.on('error', (err) => {
  // Keep this as a warning so local Docker can run without Redis.
  if (!hasLoggedRedisError) {
    hasLoggedRedisError = true;
    const errorWithList = err as { errors?: unknown[] };
    const aggregatedMessages = Array.isArray(errorWithList.errors)
      ? errorWithList.errors
          .map((item: unknown) => (item instanceof Error ? item.message : String(item)))
          .join('; ')
      : '';
    const message =
      aggregatedMessages ||
      (err instanceof Error
          ? err.message
          : String(err));
    console.warn(`Redis connection error: ${message}`);
  }
});

redis.on('connect', () => {
  console.log('Redis connected');
});

export default redis;
