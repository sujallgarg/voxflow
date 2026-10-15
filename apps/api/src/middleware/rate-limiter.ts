import type { FastifyRequest, FastifyReply } from "fastify";

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory sliding-window store keyed by IP or user ID
const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic cleanup every 2 minutes to prevent memory leak
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupOldRecords(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds (default: 60s)
  maxRequests?: number; // Max requests allowed per window (default: 120)
}

/**
 * Fastify preHandler hook for sliding-window rate limiting.
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const maxRequests = options.maxRequests || 120;

  return async function rateLimitHook(request: FastifyRequest, reply: FastifyReply) {
    // Exclude health check from rate limiting
    if (request.url === "/health") {
      return;
    }

    cleanupOldRecords(windowMs);

    const now = Date.now();
    // Key by authenticated user or IP address
    const clientKey =
      (request.headers["x-user-id"] as string) ||
      request.ip ||
      request.socket.remoteAddress ||
      "unknown_client";

    const pathPrefix = request.url.split("?")[0];
    const key = `${clientKey}:${pathPrefix}`;

    let record = rateLimitStore.get(key);
    if (!record) {
      record = { timestamps: [] };
      rateLimitStore.set(key, record);
    }

    // Filter timestamps within current sliding window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    const currentCount = record.timestamps.length;
    const remaining = Math.max(0, maxRequests - currentCount - 1);

    reply.header("x-ratelimit-limit", maxRequests);
    reply.header("x-ratelimit-remaining", remaining);

    if (currentCount >= maxRequests) {
      const oldest = record.timestamps[0] || now;
      const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);

      reply.header("Retry-After", retryAfterSeconds);
      return reply.code(429).send({
        error: "Rate limit exceeded. Please wait a moment before sending more requests.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: retryAfterSeconds
      });
    }

    record.timestamps.push(now);
  };
}

/**
 * Clear the rate limit store (useful for automated testing)
 */
export function resetRateLimits(): void {
  rateLimitStore.clear();
}
