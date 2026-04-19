import { createClient } from "redis";

const isProduction = process.env.NODE_ENV === "production";
const redisRequired = process.env.REDIS_REQUIRED_IN_PRODUCTION !== "false";

if (!isProduction || !redisRequired) {
  process.exit(0);
}

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error("[Preflight] REDIS_URL is required in production.");
  process.exit(1);
}

const shouldUseRedis =
  process.env.CACHE_ENABLED !== "false" || process.env.RATE_LIMIT_ENABLED !== "false";

if (!shouldUseRedis) {
  process.exit(0);
}

const client = createClient({ url: redisUrl });

try {
  client.on("error", (err) => {
    console.error("[Preflight] Redis client error:", err?.message || err);
  });

  await client.connect();
  await client.ping();
  await client.quit();
  console.log("[Preflight] Redis connectivity check passed.");
} catch (error) {
  console.error(
    "[Preflight] Redis connectivity check failed:",
    error instanceof Error ? error.message : String(error)
  );

  try {
    await client.disconnect();
  } catch {
    // ignore
  }

  process.exit(1);
}
