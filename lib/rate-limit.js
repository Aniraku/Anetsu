// In-memory IP rate limiter — 120 requests per minute per IP.
// Works across serverless instances via a simple sliding window.
// For production, swap to Redis (Upstash) for cross-instance consistency.

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 120;

const hits = new Map();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of hits) {
    if (now - data.windowStart > WINDOW_MS * 2) hits.delete(ip);
  }
}, 5 * 60 * 1000);

export function checkRateLimit(ip) {
  const now = Date.now();
  let entry = hits.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    hits.set(ip, entry);
  }

  entry.count++;

  const remaining = Math.max(0, MAX_REQUESTS - entry.count);
  const resetAt = entry.windowStart + WINDOW_MS;

  return {
    allowed: entry.count <= MAX_REQUESTS,
    remaining,
    resetAt: Math.ceil(resetAt / 1000),
    limit: MAX_REQUESTS,
  };
}

export function rateLimitHeaders(result) {
  const headers = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  };
  if (!result.allowed) {
    headers['Retry-After'] = String(Math.ceil((result.resetAt * 1000 - Date.now()) / 1000));
  }
  return headers;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || '127.0.0.1';
}
