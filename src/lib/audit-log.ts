/**
 * Audit logging utility for tracking user actions
 * Persists audit events to the database for compliance and debugging
 */

import { createClient } from "@supabase/supabase-js";

export type AuditAction =
  // Auth actions
  | "login"
  | "logout"
  | "password_change"
  | "password_reset_request"
  // Admin actions
  | "client_create"
  | "client_update"
  | "client_delete"
  | "campaign_create"
  | "campaign_update"
  | "campaign_delete"
  | "campaign_toggle_active"
  | "admin_user_create"
  | "admin_user_update"
  | "admin_user_delete"
  | "invite_send"
  | "invite_accept"
  // Data actions
  | "call_view"
  | "call_export"
  | "call_delete"
  | "webhook_reprocess"
  | "ai_retry"
  // Settings actions
  | "settings_update"
  | "api_key_regenerate"
  | "webhook_token_regenerate";

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  userType?: "admin" | "client";
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// Lazy init to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    await supabase.from("audit_logs").insert({
      action: entry.action,
      user_id: entry.userId,
      user_email: entry.userEmail,
      user_type: entry.userType,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      details: entry.details,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Don't throw - audit logging should not break functionality
    console.error("Failed to log audit event:", error);
  }
}

/**
 * Helper to extract user info from request headers
 */
export function extractRequestInfo(request: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");

  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() || realIp || cfIp || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  return { ipAddress, userAgent };
}

/**
 * Audit logger singleton for convenient access
 */
export const auditLog = {
  // Auth events
  login: (userId: string, userEmail: string, userType: "admin" | "client", request?: Request) =>
    logAuditEvent({
      action: "login",
      userId,
      userEmail,
      userType,
      ...(request ? extractRequestInfo(request) : {}),
    }),

  logout: (userId: string, userEmail?: string, request?: Request) =>
    logAuditEvent({
      action: "logout",
      userId,
      userEmail,
      ...(request ? extractRequestInfo(request) : {}),
    }),

  passwordChange: (userId: string, userEmail?: string, request?: Request) =>
    logAuditEvent({
      action: "password_change",
      userId,
      userEmail,
      ...(request ? extractRequestInfo(request) : {}),
    }),

  passwordResetRequest: (email: string, request?: Request) =>
    logAuditEvent({
      action: "password_reset_request",
      userEmail: email,
      ...(request ? extractRequestInfo(request) : {}),
    }),

  // Client management
  clientCreate: (adminId: string, clientId: string, details?: Record<string, unknown>) =>
    logAuditEvent({
      action: "client_create",
      userId: adminId,
      userType: "admin",
      resourceType: "client",
      resourceId: clientId,
      details,
    }),

  clientUpdate: (adminId: string, clientId: string, details?: Record<string, unknown>) =>
    logAuditEvent({
      action: "client_update",
      userId: adminId,
      userType: "admin",
      resourceType: "client",
      resourceId: clientId,
      details,
    }),

  clientDelete: (adminId: string, clientId: string) =>
    logAuditEvent({
      action: "client_delete",
      userId: adminId,
      userType: "admin",
      resourceType: "client",
      resourceId: clientId,
    }),

  // Campaign management
  campaignCreate: (adminId: string, campaignId: string, details?: Record<string, unknown>) =>
    logAuditEvent({
      action: "campaign_create",
      userId: adminId,
      userType: "admin",
      resourceType: "campaign",
      resourceId: campaignId,
      details,
    }),

  campaignUpdate: (adminId: string, campaignId: string, details?: Record<string, unknown>) =>
    logAuditEvent({
      action: "campaign_update",
      userId: adminId,
      userType: "admin",
      resourceType: "campaign",
      resourceId: campaignId,
      details,
    }),

  campaignDelete: (adminId: string, campaignId: string) =>
    logAuditEvent({
      action: "campaign_delete",
      userId: adminId,
      userType: "admin",
      resourceType: "campaign",
      resourceId: campaignId,
    }),

  campaignToggle: (adminId: string, campaignId: string, isActive: boolean) =>
    logAuditEvent({
      action: "campaign_toggle_active",
      userId: adminId,
      userType: "admin",
      resourceType: "campaign",
      resourceId: campaignId,
      details: { isActive },
    }),

  // Data actions
  callExport: (userId: string, userType: "admin" | "client", callIds: string[]) =>
    logAuditEvent({
      action: "call_export",
      userId,
      userType,
      resourceType: "call",
      details: { callIds, count: callIds.length },
    }),

  webhookReprocess: (adminId: string, webhookLogId: string) =>
    logAuditEvent({
      action: "webhook_reprocess",
      userId: adminId,
      userType: "admin",
      resourceType: "webhook_log",
      resourceId: webhookLogId,
    }),

  aiRetry: (adminId: string, callId: string) =>
    logAuditEvent({
      action: "ai_retry",
      userId: adminId,
      userType: "admin",
      resourceType: "call",
      resourceId: callId,
    }),

  // Settings
  settingsUpdate: (userId: string, userType: "admin" | "client", settingType: string) =>
    logAuditEvent({
      action: "settings_update",
      userId,
      userType,
      details: { settingType },
    }),

  webhookTokenRegenerate: (adminId: string, campaignId: string) =>
    logAuditEvent({
      action: "webhook_token_regenerate",
      userId: adminId,
      userType: "admin",
      resourceType: "campaign",
      resourceId: campaignId,
    }),
};

export default auditLog;
