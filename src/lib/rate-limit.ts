import { NextResponse } from 'next/server';

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (for production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

export function getRateLimitKey(identifier: string, endpoint: string): string {
  return `${identifier}:${endpoint}`;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.interval,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.interval,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}

// Pre-configured rate limits
export const RATE_LIMITS = {
  // Standard API: 100 requests per minute
  standard: { interval: 60000, maxRequests: 100 },
  // Auth endpoints: 10 requests per minute
  auth: { interval: 60000, maxRequests: 10 },
  // Write operations: 30 requests per minute
  write: { interval: 60000, maxRequests: 30 },
  // Search/heavy operations: 20 requests per minute
  search: { interval: 60000, maxRequests: 20 },
} as const;

// Helper to create rate limit response
export function rateLimitExceeded(resetIn: number): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(resetIn / 1000),
    },
    {
      status: 429,
      headers: {
        'Retry-After': Math.ceil(resetIn / 1000).toString(),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

// Middleware helper for API routes
export function withRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMITS.standard
): { allowed: boolean; response?: NextResponse; headers: Record<string, string> } {
  const key = getRateLimitKey(userId, endpoint);
  const result = checkRateLimit(key, config);

  const headers = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetIn / 1000).toString(),
  };

  if (!result.allowed) {
    return {
      allowed: false,
      response: rateLimitExceeded(result.resetIn),
      headers,
    };
  }

  return { allowed: true, headers };
}
