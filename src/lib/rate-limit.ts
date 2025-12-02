/**
 * Rate Limiting Utilities
 * Provides rate limiting for login attempts and API requests
 */

import { createServiceClient } from "@/lib/supabase/server";

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // Time window in milliseconds
  blockDurationMs: number; // How long to block after exceeding limit
}

const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes block
};

const API_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 100,
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 5 * 60 * 1000, // 5 minutes block
};

interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  resetAt: Date | null;
  blockedUntil: Date | null;
}

/**
 * Check login rate limit for an email/IP combination
 */
export async function checkLoginRateLimit(
  email: string,
  ipAddress: string
): Promise<RateLimitResult> {
  const supabase = await createServiceClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - LOGIN_RATE_LIMIT.windowMs);

  // Count recent failed attempts for this email
  const { count: emailAttempts } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("email", email.toLowerCase())
    .eq("success", false)
    .gte("created_at", windowStart.toISOString());

  // Count recent failed attempts from this IP
  const { count: ipAttempts } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ipAddress)
    .eq("success", false)
    .gte("created_at", windowStart.toISOString());

  const totalAttempts = Math.max(emailAttempts || 0, ipAttempts || 0);
  const remainingAttempts = Math.max(0, LOGIN_RATE_LIMIT.maxAttempts - totalAttempts);

  // Check if blocked
  if (totalAttempts >= LOGIN_RATE_LIMIT.maxAttempts) {
    // Get the most recent failed attempt to calculate block duration
    const { data: lastAttempt } = await supabase
      .from("login_attempts")
      .select("created_at")
      .or(`email.eq.${email.toLowerCase()},ip_address.eq.${ipAddress}`)
      .eq("success", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastAttempt) {
      const lastAttemptTime = new Date(lastAttempt.created_at);
      const blockedUntil = new Date(lastAttemptTime.getTime() + LOGIN_RATE_LIMIT.blockDurationMs);

      if (now < blockedUntil) {
        return {
          allowed: false,
          remainingAttempts: 0,
          resetAt: blockedUntil,
          blockedUntil,
        };
      }
    }
  }

  return {
    allowed: remainingAttempts > 0,
    remainingAttempts,
    resetAt: new Date(now.getTime() + LOGIN_RATE_LIMIT.windowMs),
    blockedUntil: null,
  };
}

/**
 * Record a login attempt
 */
export async function recordLoginAttempt(
  email: string,
  ipAddress: string,
  success: boolean,
  userAgent?: string
): Promise<void> {
  const supabase = await createServiceClient();

  await supabase.from("login_attempts").insert({
    email: email.toLowerCase(),
    ip_address: ipAddress,
    success,
    user_agent: userAgent,
  });

  // If successful login, optionally clear failed attempts for this email
  if (success) {
    // We don't delete old attempts - they're useful for audit purposes
    // The rate limit will naturally reset based on the time window
  }
}

/**
 * Clean up old login attempts (call this periodically)
 */
export async function cleanupOldLoginAttempts(daysToKeep: number = 30): Promise<number> {
  const supabase = await createServiceClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  // First count how many will be deleted
  const { count } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact", head: true })
    .lt("created_at", cutoffDate.toISOString());

  // Then delete them
  await supabase
    .from("login_attempts")
    .delete()
    .lt("created_at", cutoffDate.toISOString());

  return count || 0;
}

// In-memory rate limiter for API requests (for serverless environments)
const apiRateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check API rate limit (in-memory, suitable for single-instance or edge functions)
 */
export function checkApiRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const record = apiRateLimitStore.get(identifier);

  // Clean up expired records periodically
  if (Math.random() < 0.01) {
    cleanupApiRateLimitStore();
  }

  if (!record || now > record.resetAt) {
    // Create new record
    apiRateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + API_RATE_LIMIT.windowMs,
    });

    return {
      allowed: true,
      remainingAttempts: API_RATE_LIMIT.maxAttempts - 1,
      resetAt: new Date(now + API_RATE_LIMIT.windowMs),
      blockedUntil: null,
    };
  }

  record.count++;

  if (record.count > API_RATE_LIMIT.maxAttempts) {
    const blockedUntil = new Date(now + API_RATE_LIMIT.blockDurationMs);
    return {
      allowed: false,
      remainingAttempts: 0,
      resetAt: new Date(record.resetAt),
      blockedUntil,
    };
  }

  return {
    allowed: true,
    remainingAttempts: API_RATE_LIMIT.maxAttempts - record.count,
    resetAt: new Date(record.resetAt),
    blockedUntil: null,
  };
}

function cleanupApiRateLimitStore(): void {
  const now = Date.now();
  for (const [key, value] of apiRateLimitStore.entries()) {
    if (now > value.resetAt) {
      apiRateLimitStore.delete(key);
    }
  }
}

/**
 * Format remaining time until rate limit reset
 */
export function formatRateLimitReset(resetAt: Date): string {
  const now = new Date();
  const diffMs = resetAt.getTime() - now.getTime();

  if (diffMs <= 0) return "now";

  const minutes = Math.ceil(diffMs / 60000);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours !== 1 ? "s" : ""}`;
}
