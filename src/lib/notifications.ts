import { createClient } from "@supabase/supabase-js";

// Lazy init to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type NotificationType = "info" | "warning" | "error" | "success" | "call_received" | "report_ready";

export interface Notification {
  id: string;
  userId: string;
  userType: "admin" | "client";
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface CreateNotificationParams {
  userId: string;
  userType: "admin" | "client";
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Create a notification for a user
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    await supabase.from("notifications").insert({
      user_id: params.userId,
      user_type: params.userType,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId);
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(
  userId: string,
  userType: "admin" | "client"
): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("user_type", userType)
      .eq("is_read", false);
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
  }
}

/**
 * Delete old notifications (keep last 100 per user)
 */
export async function cleanupOldNotifications(
  userId: string,
  userType: "admin" | "client",
  keepCount: number = 100
): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // Get notification IDs to keep
    const { data: toKeep } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("user_type", userType)
      .order("created_at", { ascending: false })
      .limit(keepCount);

    if (toKeep && toKeep.length >= keepCount) {
      const keepIds = toKeep.map((n) => n.id);

      await supabase
        .from("notifications")
        .delete()
        .eq("user_id", userId)
        .eq("user_type", userType)
        .not("id", "in", `(${keepIds.join(",")})`);
    }
  } catch (error) {
    console.error("Failed to cleanup old notifications:", error);
  }
}

// Notification helpers for common events

export async function notifyNewCall(
  clientId: string,
  campaignName: string,
  sentiment: string
): Promise<void> {
  await createNotification({
    userId: clientId,
    userType: "client",
    type: sentiment === "negative" ? "warning" : "info",
    title: "New Call Received",
    message: `A new ${sentiment} call was processed for campaign "${campaignName}"`,
    link: "/dashboard/calls",
  });
}

export async function notifyPaymentFailed(clientId: string): Promise<void> {
  await createNotification({
    userId: clientId,
    userType: "client",
    type: "error",
    title: "Payment Failed",
    message: "Your subscription payment failed. Please update your payment method.",
    link: "/dashboard/billing",
  });
}

export async function notifySubscriptionExpiring(
  clientId: string,
  daysRemaining: number
): Promise<void> {
  await createNotification({
    userId: clientId,
    userType: "client",
    type: "warning",
    title: "Subscription Expiring Soon",
    message: `Your subscription will expire in ${daysRemaining} days.`,
    link: "/dashboard/billing",
  });
}

export async function notifyUsageLimitApproaching(
  clientId: string,
  usagePercent: number
): Promise<void> {
  await createNotification({
    userId: clientId,
    userType: "client",
    type: "warning",
    title: "Usage Limit Approaching",
    message: `You've used ${usagePercent}% of your monthly call limit.`,
    link: "/dashboard/billing",
  });
}

export async function notifyAdminNewClient(
  adminId: string,
  clientName: string
): Promise<void> {
  await createNotification({
    userId: adminId,
    userType: "admin",
    type: "success",
    title: "New Client Registered",
    message: `${clientName} has accepted their invitation and created an account.`,
    link: "/admin/clients",
  });
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  userType: "admin" | "client",
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
  const supabase = getSupabaseClient();
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .eq("user_type", userType)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, count, error } = await query;

  // Get unread count separately
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("user_type", userType)
    .eq("is_read", false);

  if (error || !data) {
    console.error("Failed to get notifications:", error);
    return { notifications: [], total: 0, unreadCount: 0 };
  }

  return {
    notifications: data.map(mapNotification),
    total: count || 0,
    unreadCount: unreadCount || 0,
  };
}

/**
 * Get unread notification count only
 */
export async function getUnreadCount(
  userId: string,
  userType: "admin" | "client"
): Promise<number> {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("user_type", userType)
    .eq("is_read", false);

  if (error) {
    console.error("Failed to get unread count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) {
    console.error("Failed to delete notification:", error);
    return false;
  }

  return true;
}

/**
 * Map database row to Notification type
 */
function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userType: row.user_type as "admin" | "client",
    type: row.type as NotificationType,
    title: row.title as string,
    message: row.message as string,
    link: row.link as string | undefined,
    isRead: row.is_read as boolean,
    readAt: row.read_at ? new Date(row.read_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
  };
}
