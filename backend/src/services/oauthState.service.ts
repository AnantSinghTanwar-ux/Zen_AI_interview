import redis from '../config/redis';
import logger from '../config/logger';
import { OAuthProvider } from './oauth.service';

type SupportedStateProvider = Extract<OAuthProvider, 'github' | 'linkedin'>;

const memoryStateStore = new Map<string, number>();
const memoryCodeLockStore = new Map<string, number>();

const buildStateKey = (provider: SupportedStateProvider, state: string) =>
  `oauth_state:${provider}:${state}`;

const cleanupExpiredMemoryStates = () => {
  const now = Date.now();
  for (const [key, expiresAt] of memoryStateStore.entries()) {
    if (expiresAt <= now) {
      memoryStateStore.delete(key);
    }
  }
};

const cleanupExpiredMemoryCodeLocks = () => {
  const now = Date.now();
  for (const [key, expiresAt] of memoryCodeLockStore.entries()) {
    if (expiresAt <= now) {
      memoryCodeLockStore.delete(key);
    }
  }
};

const buildCodeKey = (provider: SupportedStateProvider, code: string) =>
  `oauth_code:${provider}:${code}`;

const tryRedisConnect = async () => {
  if (redis.status === 'wait' || redis.status === 'end') {
    await redis.connect();
  }
};

export const OAuthStateService = {
  async register(provider: SupportedStateProvider, state: string, ttlSeconds = 600): Promise<boolean> {
    const key = buildStateKey(provider, state);

    try {
      await tryRedisConnect();
      const ok = await redis.set(key, 'valid', 'EX', ttlSeconds, 'NX');
      return Boolean(ok);
    } catch (error) {
      cleanupExpiredMemoryStates();
      const now = Date.now();
      const existing = memoryStateStore.get(key);
      if (existing && existing > now) return false;

      memoryStateStore.set(key, now + ttlSeconds * 1000);
      logger.warn('Redis unavailable for OAuth state register, using memory fallback', {
        provider,
        redisStatus: redis.status,
        error,
      });
      return true;
    }
  },

  async consume(provider: SupportedStateProvider, state: string): Promise<boolean> {
    const key = buildStateKey(provider, state);

    try {
      await tryRedisConnect();
      const exists = await redis.get(key);
      if (!exists) return false;
      await redis.del(key);
      return true;
    } catch (error) {
      cleanupExpiredMemoryStates();
      const expiresAt = memoryStateStore.get(key);
      if (!expiresAt) return false;

      memoryStateStore.delete(key);
      if (expiresAt <= Date.now()) return false;

      logger.warn('Redis unavailable for OAuth state consume, using memory fallback', {
        provider,
        redisStatus: redis.status,
        error,
      });
      return true;
    }
  },

  async acquireCodeLock(
    provider: SupportedStateProvider,
    code: string,
    ttlSeconds = 300,
  ): Promise<boolean> {
    const key = buildCodeKey(provider, code);

    try {
      await tryRedisConnect();
      const lock = await redis.set(key, 'used', 'EX', ttlSeconds, 'NX');
      return Boolean(lock);
    } catch (error) {
      cleanupExpiredMemoryCodeLocks();
      const now = Date.now();
      const existing = memoryCodeLockStore.get(key);
      if (existing && existing > now) return false;

      memoryCodeLockStore.set(key, now + ttlSeconds * 1000);
      logger.warn('Redis unavailable for OAuth code lock, using memory fallback', {
        provider,
        redisStatus: redis.status,
        error,
      });
      return true;
    }
  },
};
