import { createClient } from "@supabase/supabase-js";

// Lazy init to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "login"
  | "logout"
  | "password_reset"
  | "password_changed"
  | "invite_sent"
  | "invite_accepted"
  | "subscription_created"
  | "subscription_updated"
  | "subscription_canceled"
  | "webhook_received"
  | "report_sent"
  | "api_key_updated";

export type ResourceType =
  | "client"
  | "campaign"
  | "call"
  | "settings"
  | "user"
  | "subscription"
  | "webhook"
  | "email"
  | "api_key";

export interface AuditLogEntry {
  userId?: string;
  userType: "admin" | "client";
  userEmail?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    await supabase.from("audit_logs").insert({
      user_id: entry.userId,
      user_type: entry.userType,
      user_email: entry.userEmail,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      details: entry.details,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error("Failed to log audit entry:", error);
  }
}

/**
 * Helper to extract IP from request headers
 */
export function getClientIP(headers: Headers): string | undefined {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    undefined
  );
}

/**
 * Helper to get user agent
 */
export function getUserAgent(headers: Headers): string | undefined {
  return headers.get("user-agent") || undefined;
}

/**
 * Log client action (for use in API routes)
 */
export async function logClientAction(
  userId: string,
  userEmail: string,
  action: AuditAction,
  resourceType: ResourceType,
  resourceId?: string,
  details?: Record<string, unknown>,
  headers?: Headers
): Promise<void> {
  await logAudit({
    userId,
    userType: "client",
    userEmail,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress: headers ? getClientIP(headers) : undefined,
    userAgent: headers ? getUserAgent(headers) : undefined,
  });
}

/**
 * Log admin action (for use in API routes)
 */
export async function logAdminAction(
  userId: string,
  userEmail: string,
  action: AuditAction,
  resourceType: ResourceType,
  resourceId?: string,
  details?: Record<string, unknown>,
  headers?: Headers
): Promise<void> {
  await logAudit({
    userId,
    userType: "admin",
    userEmail,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress: headers ? getClientIP(headers) : undefined,
    userAgent: headers ? getUserAgent(headers) : undefined,
  });
}
