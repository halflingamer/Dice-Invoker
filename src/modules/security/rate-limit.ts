type Bucket = { count: number; resetsAt: number };

export type RateLimiter = Readonly<{
  consume(key: string, limit: number, windowMs: number, now?: number): boolean;
}>;

export function createMemoryRateLimiter(): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    consume(key, limit, windowMs, now = Date.now()) {
      const current = buckets.get(key);
      if (!current || current.resetsAt <= now) {
        buckets.set(key, { count: 1, resetsAt: now + windowMs });
        return true;
      }
      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    },
  };
}
