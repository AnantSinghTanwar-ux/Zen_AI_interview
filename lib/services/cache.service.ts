/**
 * Cache Service — Redis-backed with in-memory fallback.
 * Usage: await cacheService.get<T>(key) / cacheService.set(key, value, ttlSecs)
 */

type InMemoryEntry = { value: unknown; expiresAt: number };

class CacheService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any | null = null;
  private inMemoryCache: Map<string, InMemoryEntry> = new Map();
  private connected = false;
  private initPromise: Promise<void> | null = null;

  private isCacheEnabled(): boolean {
    return process.env.CACHE_ENABLED !== "false";
  }

  private isRedisRequired(): boolean {
    return (
      this.isCacheEnabled() &&
      process.env.NODE_ENV === "production" &&
      process.env.REDIS_REQUIRED_IN_PRODUCTION !== "false"
    );
  }

  constructor() {
    if (!this.isCacheEnabled() || typeof window !== "undefined") {
      return;
    }

    if (!process.env.REDIS_URL) {
      if (this.isRedisRequired()) {
        throw new Error(
          "[Cache] REDIS_URL is required in production when cache is enabled"
        );
      }
      return;
    }

    // Lazily connect so next.js edge/server cold-starts aren't blocked.
    this.initPromise = this.initRedis().catch((err) => {
      if (this.isRedisRequired()) {
        throw err;
      }
      console.warn("[Cache] Redis init failed, using in-memory:", err?.message);
    });
  }

  private async initRedis() {
    try {
      // Dynamic import so the redis package is optional at build time.
      const { createClient } = await import("redis");
      this.client = createClient({ url: process.env.REDIS_URL });
      this.client.on("error", (err: Error) =>
        console.error("[Cache] Redis error:", err?.message)
      );
      await this.client.connect();
      this.connected = true;
      console.log("[Cache] Redis connected");
    } catch (err) {
      this.client = null;
      this.connected = false;
      throw err;
    }
  }

  private async ensureRedisReady(): Promise<boolean> {
    if (this.connected && this.client) return true;

    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (err) {
        if (this.isRedisRequired()) {
          throw err;
        }
      }
    }

    if (this.connected && this.client) return true;

    if (this.isRedisRequired()) {
      throw new Error(
        "[Cache] Redis is required in production and is currently unavailable"
      );
    }

    return false;
  }

  getHealth() {
    return {
      enabled: this.isCacheEnabled(),
      redisRequired: this.isRedisRequired(),
      redisConnected: this.connected,
      mode: this.connected ? "redis" : "in-memory",
    };
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isCacheEnabled()) return null;

    try {
      const redisReady = await this.ensureRedisReady();

      if (redisReady && this.client) {
        const raw = await this.client.get(key);
        if (raw) return JSON.parse(raw) as T;
        return null;
      }

      // In-memory fallback
      const entry = this.inMemoryCache.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        return entry.value as T;
      }
      if (entry) this.inMemoryCache.delete(key); // expired
      return null;
    } catch (err) {
      console.error("[Cache] get error:", (err as Error)?.message);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = Number(process.env.CACHE_TTL_SECONDS) || 7200
  ): Promise<void> {
    if (!this.isCacheEnabled()) return;

    try {
      const redisReady = await this.ensureRedisReady();

      if (redisReady && this.client) {
        await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
        return;
      }

      // In-memory fallback
      this.inMemoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    } catch (err) {
      console.error("[Cache] set error:", (err as Error)?.message);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const redisReady = await this.ensureRedisReady();

      if (redisReady && this.client) {
        await this.client.del(key);
        return;
      }
      this.inMemoryCache.delete(key);
    } catch (err) {
      console.error("[Cache] delete error:", (err as Error)?.message);
    }
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      const redisReady = await this.ensureRedisReady();

      if (redisReady && this.client) {
        const keys: string[] = await this.client.keys(pattern);
        if (keys.length > 0) await this.client.del(keys);
        return;
      }

      // In-memory: convert glob-style pattern to regex
      const regex = new RegExp(
        "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"
      );
      for (const key of this.inMemoryCache.keys()) {
        if (regex.test(key)) this.inMemoryCache.delete(key);
      }
    } catch (err) {
      console.error("[Cache] invalidateByPattern error:", (err as Error)?.message);
    }
  }
}

export const cacheService = new CacheService();

export function getCacheServiceHealth() {
  return cacheService.getHealth();
}
