/**
 * Circuit Breaker Service — wraps async calls with failure thresholds.
 *
 * When many consecutive calls fail, the breaker "opens" and immediately
 * rejects new calls for a cooldown period (30s by default), then lets
 * a single probe through ("half-open"). If the probe succeeds the
 * breaker closes again.
 */

type BreakerState = "closed" | "open" | "half-open";

interface BreakerOptions {
  /** Number of failures before the breaker opens. */
  failureThreshold?: number;
  /** Time (ms) an external call may run before being considered timed-out. */
  timeout?: number;
  /** How long the breaker stays open before allowing a single probe. */
  cooldownMs?: number;
}

interface BreakerStatus {
  name: string;
  state: BreakerState;
  failures: number;
  successes: number;
  lastFailure: string | null;
}

class CircuitBreaker<TArgs extends unknown[], TResult> {
  private state: BreakerState = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly timeout: number;
  private readonly cooldownMs: number;

  constructor(
    readonly name: string,
    private readonly fn: (...args: TArgs) => Promise<TResult>,
    options: BreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.timeout = options.timeout ?? 20_000;
    this.cooldownMs = options.cooldownMs ?? 30_000;
  }

  async fire(...args: TArgs): Promise<TResult> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        this.state = "half-open";
        console.log(`[CircuitBreaker] "${this.name}" half-open (probing)`);
      } else {
        throw new Error(`Circuit breaker "${this.name}" is open — call rejected`);
      }
    }

    try {
      const result = await Promise.race([
        this.fn(...args),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout: ${this.timeout}ms`)), this.timeout)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.successes++;
    if (this.state === "half-open") {
      console.log(`[CircuitBreaker] "${this.name}" closed (probe succeeded)`);
    }
    this.state = "closed";
    this.failures = 0;
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      console.log(
        `[CircuitBreaker] "${this.name}" opened (${this.failures} failures)`
      );
    }
  }

  getStatus(): BreakerStatus {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
    };
  }
}

// ── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<string, CircuitBreaker<unknown[], unknown>>();

export function createCircuitBreaker<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options?: BreakerOptions
): CircuitBreaker<TArgs, TResult> {
  if (registry.has(name)) {
    return registry.get(name)! as CircuitBreaker<TArgs, TResult>;
  }
  const breaker = new CircuitBreaker<TArgs, TResult>(name, fn, options);
  registry.set(name, breaker as unknown as CircuitBreaker<unknown[], unknown>);
  return breaker;
}

export function getCircuitBreakerStatus(name: string): BreakerStatus | null {
  return registry.get(name)?.getStatus() ?? null;
}

export function getAllCircuitBreakerStatuses(): BreakerStatus[] {
  return Array.from(registry.values()).map((b) => b.getStatus());
}
