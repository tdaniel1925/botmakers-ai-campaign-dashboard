// Simple in-memory rate limiter for webhook endpoints
// For production at scale, use Redis-based rate limiting

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private cache: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  isRateLimited(key: string): { limited: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (!entry || now > entry.resetTime) {
      // New window
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

// Global rate limiter instances
// Per-campaign: 200 requests per minute
export const campaignRateLimiter = new RateLimiter(60000, 200);

// Per-IP: 500 requests per minute (for all campaigns combined)
export const ipRateLimiter = new RateLimiter(60000, 500);

// AI processing queue to prevent overwhelming OpenAI
class AIProcessingQueue {
  private queue: Array<{ callId: string; processor: () => Promise<void> }> = [];
  private processing: number = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number = 10) {
    this.maxConcurrent = maxConcurrent;
  }

  async add(callId: string, processor: () => Promise<void>): Promise<void> {
    this.queue.push({ callId, processor });
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.processing++;

    try {
      await item.processor();
    } catch (error) {
      console.error(`AI processing failed for call ${item.callId}:`, error);
    } finally {
      this.processing--;
      // Process next item after a small delay to avoid hammering the API
      setTimeout(() => this.processNext(), 100);
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getProcessingCount(): number {
    return this.processing;
  }
}

// Global AI processing queue - max 10 concurrent AI calls
export const aiQueue = new AIProcessingQueue(10);
