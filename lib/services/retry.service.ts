/**
 * Retry Service — Exponential backoff for transient failures.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
}

const TRANSIENT_CODES = ["429", "503", "504", "ETIMEDOUT", "ECONNREFUSED", "ECONNRESET"];

function isTransientError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    TRANSIENT_CODES.some((code) => msg.includes(code.toLowerCase())) ||
    msg.includes("quota") ||
    msg.includes("high demand") ||
    msg.includes("service unavailable") ||
    msg.includes("too many requests") ||
    (error instanceof Error && error.name === "TimeoutError")
  );
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 200,
    backoffMultiplier = 2,
    maxDelayMs = 30_000,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isTransientError(error) || attempt === maxRetries) {
        throw error;
      }

      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );
      console.log(`[Retry] attempt ${attempt + 1}/${maxRetries} in ${delayMs}ms`);
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError ?? new Error("Max retries exceeded");
}
