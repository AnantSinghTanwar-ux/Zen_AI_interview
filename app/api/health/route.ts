import { NextResponse } from "next/server";
import { getAllCircuitBreakerStatuses } from "@/lib/services/circuit-breaker.service";
import { getCacheServiceHealth } from "@/lib/services/cache.service";
import { getRateLimitServiceHealth } from "@/lib/services/rate-limit.service";
import { getWorkerMetrics } from "@/services/feedback/feedback-worker";

/**
 * GET /api/health — Public health check endpoint.
 * Returns service status + circuit breaker states.
 */
export async function GET() {
  const circuitBreakers = getAllCircuitBreakerStatuses();
  const cacheHealth = getCacheServiceHealth();
  const rateLimitHealth = getRateLimitServiceHealth();

  let workerMetrics: Awaited<ReturnType<typeof getWorkerMetrics>> | null = null;
  try {
    workerMetrics = await getWorkerMetrics();
  } catch (error) {
    workerMetrics = null;
    console.warn("[Health] Failed to load worker metrics:", error);
  }

  const redisCriticalFailure =
    (cacheHealth.redisRequired && !cacheHealth.redisConnected) ||
    (rateLimitHealth.redisRequired && !rateLimitHealth.redisConnected);

  const healthy =
    circuitBreakers.every((cb) => cb.state !== "open") && !redisCriticalFailure;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
      services: {
        aiProvider: process.env.AI_PROVIDER || "openrouter",
        cache: cacheHealth,
        rateLimit: rateLimitHealth,
      },
      queues: workerMetrics,
      circuitBreakers,
    },
    { status: healthy ? 200 : 503 }
  );
}
