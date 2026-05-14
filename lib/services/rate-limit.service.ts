/**
 * Rate Limit Service — Redis-backed with in-memory fallback.
 * Uses a sliding-window counter per key.
 */

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

class RateLimiter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any | null = null;
  private connected = false;
  private initPromise: Promise<void> | null = null;
  private inMemoryStore: Map<string, { count: number; resetTime: number }> = new Map();

  private isRateLimitEnabled(): boolean {
    return process.env.RATE_LIMIT_ENABLED !== "false";
  }

  private isRedisRequired(): boolean {
    return (
      this.isRateLimitEnabled() &&
      process.env.NODE_ENV === "production" &&
      process.env.REDIS_REQUIRED_IN_PRODUCTION === "true"
    );
  }

  constructor() {
    if (!this.isRateLimitEnabled() || typeof window !== "undefined") {
      return;
    }

    if (!process.env.REDIS_URL) {
      if (this.isRedisRequired()) {
        throw new Error(
          "[RateLimit] REDIS_URL is required in production when rate limiting is enabled"
        );
      }
      return;
    }

    this.initPromise = this.initRedis().catch((err) => {
      if (this.isRedisRequired()) {
        throw err;
      }
      console.warn("[RateLimit] Redis init failed, using in-memory:", err?.message);
    });
  }

  private async initRedis() {
    const { createClient } = await import("redis");
    this.client = createClient({ url: process.env.REDIS_URL });
    this.client.on("error", (err: Error) =>
      console.error("[RateLimit] Redis error:", err?.message)
    );
    await this.client.connect();
    this.connected = true;
    console.log("[RateLimit] Redis connected");
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
        "[RateLimit] Redis is required in production and is currently unavailable"
      );
    }

    return false;
  }

  async checkAndTrack(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSecs = Math.ceil(config.windowMs / 1000);
    const redisKey = `rl:${key}`;

    const redisReady = await this.ensureRedisReady();

    if (redisReady && this.client) {
      try {
        const current: number = await this.client.incr(redisKey);
        if (current === 1) {
          await this.client.expire(redisKey, windowSecs);
        }
        const ttlMs: number = (await this.client.pttl(redisKey)) || config.windowMs;
        return {
          allowed: current <= config.limit,
          remaining: Math.max(0, config.limit - current),
          resetTime: now + ttlMs,
        };
      } catch (err) {
        console.error("[RateLimit] Redis check failed:", (err as Error)?.message);
        // fall through to in-memory
      }
    }

    // In-memory fallback
    let bucket = this.inMemoryStore.get(key);
    if (!bucket || bucket.resetTime < now) {
      bucket = { count: 0, resetTime: now + config.windowMs };
      this.inMemoryStore.set(key, bucket);
    }
    bucket.count++;
    return {
      allowed: bucket.count <= config.limit,
      remaining: Math.max(0, config.limit - bucket.count),
      resetTime: bucket.resetTime,
    };
  }

  async reset(key: string): Promise<void> {
    const redisReady = await this.ensureRedisReady();

    if (redisReady && this.client) {
      try {
        await this.client.del(`rl:${key}`);
        return;
      } catch {
        // fall through
      }
    }
    this.inMemoryStore.delete(key);
  }

  getHealth() {
    return {
      enabled: this.isRateLimitEnabled(),
      redisRequired: this.isRedisRequired(),
      redisConnected: this.connected,
      mode: this.connected ? "redis" : "in-memory",
    };
  }
}

export const rateLimiter = new RateLimiter();

export function getRateLimitServiceHealth() {
  return rateLimiter.getHealth();
}

// ──────────────────────────────────────────────
// Limit definitions
// ──────────────────────────────────────────────

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "feedback-generate": {
    limit: Number(process.env.RATE_LIMIT_FEEDBACK_PER_HOUR ?? 30),
    windowMs: 3_600_000,
  },
  "feedback-read": {
    limit: Number(process.env.RATE_LIMIT_FEEDBACK_READ_PER_HOUR ?? 60),
    windowMs: 3_600_000,
  },
  "feedback-write": {
    limit: Number(process.env.RATE_LIMIT_FEEDBACK_WRITE_PER_HOUR ?? 20),
    windowMs: 3_600_000,
  },
  "feedback-job-status": {
    limit: Number(process.env.RATE_LIMIT_FEEDBACK_JOB_STATUS_PER_HOUR ?? 240),
    windowMs: 3_600_000,
  },
  "emotion-analyze": {
    limit: Number(process.env.RATE_LIMIT_EMOTION_PER_HOUR ?? 20),
    windowMs: 3_600_000,
  },
  "interview-evaluation": {
    limit: Number(process.env.RATE_LIMIT_EVALUATION_PER_HOUR ?? 15),
    windowMs: 3_600_000,
  },
  "call-data": {
    limit: Number(process.env.RATE_LIMIT_CALL_DATA_PER_HOUR ?? 60),
    windowMs: 3_600_000,
  },
  "call-data-detail": {
    limit: Number(process.env.RATE_LIMIT_CALL_DATA_DETAIL_PER_HOUR ?? 60),
    windowMs: 3_600_000,
  },
  "vapi-chat": {
    limit: Number(process.env.RATE_LIMIT_VAPI_CHAT_PER_HOUR ?? 120),
    windowMs: 3_600_000,
  },
  "vapi-chat-stream": {
    limit: Number(process.env.RATE_LIMIT_VAPI_CHAT_STREAM_PER_HOUR ?? 120),
    windowMs: 3_600_000,
  },
  "vapi-dsa-assistant": {
    limit: Number(process.env.RATE_LIMIT_VAPI_DSA_ASSISTANT_PER_HOUR ?? 30),
    windowMs: 3_600_000,
  },
  "vapi-generate": {
    limit: Number(process.env.RATE_LIMIT_VAPI_GENERATE_PER_HOUR ?? 30),
    windowMs: 3_600_000,
  },
  "premium-vapi-access-check": {
    limit: Number(process.env.RATE_LIMIT_PREMIUM_VAPI_ACCESS_PER_HOUR ?? 240),
    windowMs: 3_600_000,
  },
  "vapi-test": {
    limit: Number(process.env.RATE_LIMIT_VAPI_TEST_PER_HOUR ?? 30),
    windowMs: 3_600_000,
  },
  "call-logs": {
    limit: Number(process.env.RATE_LIMIT_LOGS_PER_HOUR ?? 60),
    windowMs: 3_600_000,
  },
  "call-logs-write": {
    limit: Number(process.env.RATE_LIMIT_LOGS_WRITE_PER_HOUR ?? 60),
    windowMs: 3_600_000,
  },
  "call-logs-migrate": {
    limit: Number(process.env.RATE_LIMIT_LOGS_MIGRATE_PER_HOUR ?? 10),
    windowMs: 3_600_000,
  },
  "call-data-sync": {
    limit: Number(process.env.RATE_LIMIT_CALL_DATA_SYNC_PER_HOUR ?? 60),
    windowMs: 3_600_000,
  },
  "analytics": {
    limit: Number(process.env.RATE_LIMIT_ANALYTICS_PER_HOUR ?? 30),
    windowMs: 3_600_000,
  },
  "gamification-progress": {
    limit: Number(process.env.RATE_LIMIT_GAMIFICATION_PER_HOUR ?? 120),
    windowMs: 3_600_000,
  },
  "applicants-list": {
    limit: Number(process.env.RATE_LIMIT_RECRUITER_PER_HOUR ?? 60),
    windowMs: 3_600_000,
  },
  "recruiter-read": {
    limit: Number(process.env.RATE_LIMIT_RECRUITER_READ_PER_HOUR ?? 120),
    windowMs: 3_600_000,
  },
  "recruiter-write": {
    limit: Number(process.env.RATE_LIMIT_RECRUITER_WRITE_PER_HOUR ?? 60),
    windowMs: 3_600_000,
  },
  "feedback-job-create": {
    limit: Number(process.env.RATE_LIMIT_FEEDBACK_PER_HOUR ?? 5),
    windowMs: 3_600_000,
  },
  "razorpay-create-order": {
    limit: Number(process.env.RATE_LIMIT_RAZORPAY_ORDER_PER_HOUR ?? 10),
    windowMs: 3_600_000,
  },
  "razorpay-verify-payment": {
    limit: Number(process.env.RATE_LIMIT_RAZORPAY_VERIFY_PER_HOUR ?? 15),
    windowMs: 3_600_000,
  },
};

const IP_GLOBAL: RateLimitConfig = {
  limit: Number(process.env.RATE_LIMIT_IP_GLOBAL_PER_MINUTE ?? 100),
  windowMs: 60_000,
};

// ──────────────────────────────────────────────
// Public helper used in route handlers
// ──────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

function resolveClientIp(request: NextRequest): string | null {
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const fallbackIp = (request as NextRequest & { ip?: string }).ip?.trim();
  const ip = forwardedIp || realIp || fallbackIp || "";

  if (!ip || ip.toLowerCase() === "unknown") {
    return null;
  }

  return ip;
}

function isLocalLoopbackIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/, "").toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

export async function checkRateLimit(
  request: NextRequest,
  userId: string,
  limitKey: string
): Promise<{ allowed: boolean; response?: NextResponse }> {
  if (process.env.RATE_LIMIT_ENABLED === "false") return { allowed: true };

  const config = RATE_LIMITS[limitKey];
  if (!config) return { allowed: true };

  // Per-user check
  const userCheck = await rateLimiter.checkAndTrack(`user:${userId}:${limitKey}`, config);
  if (!userCheck.allowed) {
    const retryAfterSecs = Math.ceil((userCheck.resetTime - Date.now()) / 1000);
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: retryAfterSecs },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSecs),
            "X-RateLimit-Limit": String(config.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(userCheck.resetTime).toISOString(),
          },
        }
      ),
    };
  }

  // Global IP check
  const clientIp = resolveClientIp(request);
  if (!clientIp) {
    return { allowed: true };
  }

  // In local/dev environments a load test often comes from loopback;
  // enforce per-user limits while skipping shared loopback global throttling.
  if (process.env.NODE_ENV !== "production" && isLocalLoopbackIp(clientIp)) {
    return { allowed: true };
  }

  const ipCheck = await rateLimiter.checkAndTrack(`ip:${clientIp}:global`, IP_GLOBAL);
  if (!ipCheck.allowed) {
    const retryAfterSecs = Math.ceil((ipCheck.resetTime - Date.now()) / 1000);
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "IP rate limit exceeded", retryAfter: retryAfterSecs },
        { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
      ),
    };
  }

  return { allowed: true };
}
