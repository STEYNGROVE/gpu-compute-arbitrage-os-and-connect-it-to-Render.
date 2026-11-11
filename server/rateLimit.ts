import type { RequestHandler } from 'express';

/** Use Express's peer address policy; never trust a caller-supplied forwarding header. */
export function rateLimit(limit = 120, windowMs = 60_000, maxKeys = 10_000, clock = Date.now): RequestHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const now = clock();
    const key = req.ip || req.socket.remoteAddress || 'global';
    for (const [address, bucket] of buckets) {
      if (now >= bucket.resetAt) buckets.delete(address);
    }
    let bucket = buckets.get(key);
    if (!bucket && buckets.size < maxKeys) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    if (!bucket || ++bucket.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil(((bucket?.resetAt ?? now + windowMs) - now) / 1000))));
      res.status(429).json({ status: 'error', message: 'Rate limit exceeded. Please throttle requests.' });
      return;
    }
    next();
  };
}
