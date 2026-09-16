/**
 * Tiny in-memory rate limiter.
 *
 * Enough to stop someone hammering the public reservation endpoint from a
 * script. It resets whenever the server restarts, which is fine for a wedding
 * website; swap in Upstash/Redis if you ever need it to survive restarts or
 * run across several instances.
 */

type Bucket = { count: number; resetAt: number };

const globalForLimiter = globalThis as unknown as {
  __weddingRateLimitBuckets?: Map<string, Bucket>;
};

function getBuckets(): Map<string, Bucket> {
  if (!globalForLimiter.__weddingRateLimitBuckets) {
    globalForLimiter.__weddingRateLimitBuckets = new Map<string, Bucket>();
  }
  return globalForLimiter.__weddingRateLimitBuckets;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** Records one hit for `key` and reports whether the caller may continue. */
export function checkRateLimit(key: string, limit = 20, windowMs = 10 * 60 * 1000): RateLimitResult {
  const buckets = getBuckets();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1),
    };
  }

  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/** Best-effort client identity for rate limiting. */
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return `reserve:${ip}`;
}

/** Housekeeping so the map cannot grow forever. */
export function pruneRateLimitBuckets(): void {
  const buckets = getBuckets();
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}