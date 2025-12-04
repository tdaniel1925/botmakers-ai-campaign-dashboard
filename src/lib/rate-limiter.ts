/**
 * Distributed Rate Limiter with Redis (Upstash) support
 * Falls back to in-memory for development or if Redis is unavailable
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Check if Redis is configured
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(REDIS_URL && REDIS_TOKEN);

// Initialize Redis client if configured
let redis: Redis | null = null;
if (USE_REDIS) {
  try {
    redis = new Redis({
      url: REDIS_URL!,
      token: REDIS_TOKEN!,
    });
    console.log("Redis rate limiting enabled");
  } catch (error) {
    console.warn("Failed to initialize Redis, falling back to in-memory:", error);
  }
}

// ============= Redis-backed Rate Limiters =============

// Per-campaign: 200 requests per minute
const campaignRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, "1 m"),
      analytics: true,
      prefix: "ratelimit:campaign",
    })
  : null;

// Per-IP: 500 requests per minute
const ipRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(500, "1 m"),
      analytics: true,
      prefix: "ratelimit:ip",
    })
  : null;

// Auth rate limiting: 10 attempts per 15 minutes per IP (stricter for security)
const authRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      analytics: true,
      prefix: "ratelimit:auth",
    })
  : null;

// ============= In-Memory Fallback =============

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class InMemoryRateLimiter {
  private cache: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up old entries every minute (only in Node.js environment)
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
  }

  isRateLimited(key: string): { limited: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (!entry || now > entry.resetTime) {
      this.cache.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return { limited: false, remaining: this.maxRequests - 1, resetIn: this.windowMs };
    }

    if (entry.count >= this.maxRequests) {
      return {
        limited: true,
        remaining: 0,
        resetIn: entry.resetTime - now,
      };
    }

    entry.count++;
    return {
      limited: false,
      remaining: this.maxRequests - entry.count,
      resetIn: entry.resetTime - now,
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.resetTime) {
        this.cache.delete(key);
      }
    }
  }
}

// In-memory fallbacks
const inMemoryCampaignLimiter = new InMemoryRateLimiter(60000, 200);
const inMemoryIpLimiter = new InMemoryRateLimiter(60000, 500);
const inMemoryAuthLimiter = new InMemoryRateLimiter(900000, 10); // 15 minutes, 10 attempts

// ============= Unified Rate Limiter Interface =============

interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetIn: number;
}

class UnifiedRateLimiter {
  private redisLimiter: Ratelimit | null;
  private fallbackLimiter: InMemoryRateLimiter;
  private name: string;

  constructor(
    redisLimiter: Ratelimit | null,
    fallbackLimiter: InMemoryRateLimiter,
    name: string
  ) {
    this.redisLimiter = redisLimiter;
    this.fallbackLimiter = fallbackLimiter;
    this.name = name;
  }

  async isRateLimited(key: string): Promise<RateLimitResult> {
    // Try Redis first
    if (this.redisLimiter) {
      try {
        const result = await this.redisLimiter.limit(key);
        return {
          limited: !result.success,
          remaining: result.remaining,
          resetIn: result.reset - Date.now(),
        };
      } catch (error) {
        console.warn(`Redis rate limit check failed for ${this.name}, using fallback:`, error);
      }
    }

    // Fallback to in-memory
    return this.fallbackLimiter.isRateLimited(key);
  }

  // Synchronous version for backward compatibility (uses fallback only)
  isRateLimitedSync(key: string): RateLimitResult {
    return this.fallbackLimiter.isRateLimited(key);
  }
}

// Export unified rate limiters
export const campaignRateLimiter = new UnifiedRateLimiter(
  campaignRatelimit,
  inMemoryCampaignLimiter,
  "campaign"
);

export const ipRateLimiter = new UnifiedRateLimiter(
  ipRatelimit,
  inMemoryIpLimiter,
  "ip"
);

// Auth rate limiter - stricter limits for login/signup
export const authRateLimiter = new UnifiedRateLimiter(
  authRatelimit,
  inMemoryAuthLimiter,
  "auth"
);

// ============= AI Processing Queue with Database Persistence =============

interface QueuedJob {
  callId: string;
  processor: () => Promise<void>;
  retries: number;
  addedAt: number;
}

class AIProcessingQueue {
  private queue: QueuedJob[] = [];
  private processing: number = 0;
  private readonly maxConcurrent: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(
    maxConcurrent: number = 10,
    maxRetries: number = 3,
    retryDelayMs: number = 5000
  ) {
    this.maxConcurrent = maxConcurrent;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  async add(callId: string, processor: () => Promise<void>): Promise<void> {
    this.queue.push({
      callId,
      processor,
      retries: 0,
      addedAt: Date.now(),
    });
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.processing++;

    try {
      await Promise.race([
        job.processor(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AI processing timeout")), 60000)
        ),
      ]);
    } catch (error) {
      console.error(`AI processing failed for call ${job.callId}:`, error);

      // Retry logic
      if (job.retries < this.maxRetries) {
        job.retries++;
        console.log(`Retrying call ${job.callId} (attempt ${job.retries}/${this.maxRetries})`);
        setTimeout(() => {
          this.queue.push(job);
          this.processNext();
        }, this.retryDelayMs * job.retries);
      } else {
        console.error(`Max retries exceeded for call ${job.callId}`);
        // Mark as failed in database
        await this.markAsFailed(job.callId, error);
      }
    } finally {
      this.processing--;
      // Process next item after a small delay to avoid hammering the API
      setTimeout(() => this.processNext(), 100);
    }
  }

  private async markAsFailed(callId: string, error: unknown): Promise<void> {
    try {
      // Import dynamically to avoid circular dependency
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabase
        .from("calls")
        .update({
          status: "ai_failed",
          ai_processed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", callId);
    } catch (dbError) {
      console.error(`Failed to mark call ${callId} as failed:`, dbError);
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getProcessingCount(): number {
    return this.processing;
  }

  getStats(): { queued: number; processing: number; maxConcurrent: number } {
    return {
      queued: this.queue.length,
      processing: this.processing,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

// Global AI processing queue - max 10 concurrent AI calls with retry
export const aiQueue = new AIProcessingQueue(10, 3, 5000);

// ============= Webhook Deduplication =============

class WebhookDeduplicator {
  private redis: Redis | null;
  private inMemoryCache: Map<string, number> = new Map();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 300000) {
    // 5 minutes default
    this.redis = redis;
    this.ttlMs = ttlMs;

    // Cleanup in-memory cache periodically
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanupMemory(), 60000);
    }
  }

  /**
   * Check if this webhook has been processed recently
   * Returns true if it's a duplicate
   */
  async isDuplicate(campaignId: string, externalCallId: string): Promise<boolean> {
    if (!externalCallId) return false;

    const key = `webhook:dedup:${campaignId}:${externalCallId}`;

    // Try Redis first
    if (this.redis) {
      try {
        const exists = await this.redis.exists(key);
        if (exists) return true;

        // Set with TTL
        await this.redis.set(key, Date.now(), { ex: Math.floor(this.ttlMs / 1000) });
        return false;
      } catch (error) {
        console.warn("Redis dedup check failed, using memory:", error);
      }
    }

    // Fallback to in-memory
    const existing = this.inMemoryCache.get(key);
    if (existing && Date.now() - existing < this.ttlMs) {
      return true;
    }

    this.inMemoryCache.set(key, Date.now());
    return false;
  }

  private cleanupMemory(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.inMemoryCache.entries()) {
      if (now - timestamp > this.ttlMs) {
        this.inMemoryCache.delete(key);
      }
    }
  }
}

export const webhookDeduplicator = new WebhookDeduplicator(300000);

// ============= Health Check =============

export async function getRateLimiterHealth(): Promise<{
  redis: boolean;
  redisLatency?: number;
  queueStats: { queued: number; processing: number; maxConcurrent: number };
}> {
  let redisHealthy = false;
  let redisLatency: number | undefined;

  if (redis) {
    try {
      const start = Date.now();
      await redis.ping();
      redisLatency = Date.now() - start;
      redisHealthy = true;
    } catch {
      redisHealthy = false;
    }
  }

  return {
    redis: redisHealthy,
    redisLatency,
    queueStats: aiQueue.getStats(),
  };
}
