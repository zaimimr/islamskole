import "server-only";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

interface RateLimitStore {
  hit(key: string, windowMs: number, limit: number): RateLimitResult;
}

type Bucket = { count: number; resetAt: number };

class InMemoryStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();
  private lastPrune = 0;

  hit(key: string, windowMs: number, limit: number): RateLimitResult {
    const now = Date.now();
    this.prune(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true };
    }

    if (bucket.count >= limit) {
      return { ok: false, retryAfterMs: bucket.resetAt - now };
    }

    bucket.count += 1;
    return { ok: true };
  }

  private prune(now: number) {
    if (now - this.lastPrune < 60_000) return;
    this.lastPrune = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

const store: RateLimitStore = new InMemoryStore();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  return store.hit(key, opts.windowMs, opts.limit);
}
