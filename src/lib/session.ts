/**
 * Session Management Utilities
 * Handles session timeout, auto-logout, and activity tracking
 */

import { createServiceClient } from "@/lib/supabase/server";

const SESSION_CONFIG = {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  idleTimeout: 30 * 60 * 1000, // 30 minutes of inactivity
  extendOnActivity: true,
  warnBeforeExpiry: 5 * 60 * 1000, // Warn 5 minutes before expiry
};

interface Session {
  id: string;
  userId: string;
  userType: "admin" | "client";
  sessionToken: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: Date;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

interface SessionValidation {
  valid: boolean;
  session: Session | null;
  reason?: "expired" | "inactive" | "invalid" | "not_found";
  expiresIn?: number;
  shouldWarn?: boolean;
}

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  userType: "admin" | "client",
  ipAddress?: string,
  userAgent?: string
): Promise<Session | null> {
  const supabase = await createServiceClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_CONFIG.maxAge);
  const sessionToken = generateSessionToken();

  const { data, error } = await supabase
    .from("user_sessions")
    .insert({
      user_id: userId,
      user_type: userType,
      session_token: sessionToken,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      last_activity_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to create session:", error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    userType: data.user_type,
    sessionToken: data.session_token,
    ipAddress: data.ip_address,
    userAgent: data.user_agent,
    lastActivityAt: new Date(data.last_activity_at),
    expiresAt: new Date(data.expires_at),
    isActive: data.is_active,
    createdAt: new Date(data.created_at),
  };
}

/**
 * Validate and optionally extend a session
 */
export async function validateSession(
  sessionToken: string,
  extendSession: boolean = true
): Promise<SessionValidation> {
  const supabase = await createServiceClient();
  const now = new Date();

  const { data, error } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("session_token", sessionToken)
    .single();

  if (error || !data) {
    return { valid: false, session: null, reason: "not_found" };
  }

  const session: Session = {
    id: data.id,
    userId: data.user_id,
    userType: data.user_type,
    sessionToken: data.session_token,
    ipAddress: data.ip_address,
    userAgent: data.user_agent,
    lastActivityAt: new Date(data.last_activity_at),
    expiresAt: new Date(data.expires_at),
    isActive: data.is_active,
    createdAt: new Date(data.created_at),
  };

  // Check if session is marked inactive
  if (!session.isActive) {
    return { valid: false, session, reason: "inactive" };
  }

  // Check if session has expired
  if (now > session.expiresAt) {
    await invalidateSession(sessionToken);
    return { valid: false, session, reason: "expired" };
  }

  // Check idle timeout
  const idleTime = now.getTime() - session.lastActivityAt.getTime();
  if (idleTime > SESSION_CONFIG.idleTimeout) {
    await invalidateSession(sessionToken);
    return { valid: false, session, reason: "inactive" };
  }

  // Calculate time until expiry
  const expiresIn = session.expiresAt.getTime() - now.getTime();
  const shouldWarn = expiresIn <= SESSION_CONFIG.warnBeforeExpiry;

  // Extend session on activity
  if (extendSession && SESSION_CONFIG.extendOnActivity) {
    await updateSessionActivity(sessionToken);
  }

  return {
    valid: true,
    session,
    expiresIn,
    shouldWarn,
  };
}

/**
 * Update last activity timestamp for a session
 */
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  const supabase = await createServiceClient();

  await supabase
    .from("user_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("session_token", sessionToken);
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(sessionToken: string): Promise<void> {
  const supabase = await createServiceClient();

  await supabase
    .from("user_sessions")
    .update({ is_active: false })
    .eq("session_token", sessionToken);
}

/**
 * Invalidate all sessions for a user (force logout everywhere)
 */
export async function invalidateAllUserSessions(
  userId: string,
  userType: "admin" | "client"
): Promise<number> {
  const supabase = await createServiceClient();

  // First count active sessions
  const { count } = await supabase
    .from("user_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("user_type", userType)
    .eq("is_active", true);

  // Then invalidate them
  await supabase
    .from("user_sessions")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("user_type", userType)
    .eq("is_active", true);

  return count || 0;
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(
  userId: string,
  userType: "admin" | "client"
): Promise<Session[]> {
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("user_type", userType)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .order("last_activity_at", { ascending: false });

  if (!data) return [];

  return data.map((s) => ({
    id: s.id,
    userId: s.user_id,
    userType: s.user_type,
    sessionToken: s.session_token,
    ipAddress: s.ip_address,
    userAgent: s.user_agent,
    lastActivityAt: new Date(s.last_activity_at),
    expiresAt: new Date(s.expires_at),
    isActive: s.is_active,
    createdAt: new Date(s.created_at),
  }));
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // First count expired/inactive sessions
  const { count } = await supabase
    .from("user_sessions")
    .select("*", { count: "exact", head: true })
    .or(`expires_at.lt.${now},is_active.eq.false`);

  // Then delete them
  await supabase
    .from("user_sessions")
    .delete()
    .or(`expires_at.lt.${now},is_active.eq.false`);

  return count || 0;
}

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Get session config for client-side use
 */
export function getSessionConfig() {
  return {
    idleTimeout: SESSION_CONFIG.idleTimeout,
    warnBeforeExpiry: SESSION_CONFIG.warnBeforeExpiry,
  };
}
