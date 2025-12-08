import { createClient } from "@/lib/supabase/server";
import { StatsCard } from "@/components/shared/stats-card";
import { Phone, Users, Megaphone, TrendingUp, AlertTriangle, XCircle, PauseCircle } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch stats - include both inbound and outbound campaigns
  const [clientsResult, inboundCampaignsResult, outboundCampaignsResult, legacyCallsResult, inboundCallsResult] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("inbound_campaigns").select("id", { count: "exact", head: true }),
    supabase.from("outbound_campaigns").select("id", { count: "exact", head: true }),
    supabase.from("calls").select("id", { count: "exact", head: true }),
    supabase.from("inbound_campaign_calls").select("id", { count: "exact", head: true }),
  ]);

  const totalClients = clientsResult.count || 0;
  const totalCampaigns = (inboundCampaignsResult.count || 0) + (outboundCampaignsResult.count || 0);
  const totalCalls = (legacyCallsResult.count || 0) + (inboundCallsResult.count || 0);

  // Get today's calls (including both legacy and inbound)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayLegacyCalls, todayInboundCalls] = await Promise.all([
    supabase.from("calls").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    supabase.from("inbound_campaign_calls").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
  ]);
  const todayCalls = (todayLegacyCalls.count || 0) + (todayInboundCalls.count || 0);

  // Get failed webhooks in last 24 hours (both legacy and inbound)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failedLegacyWebhooks, failedInboundWebhooks] = await Promise.all([
    supabase.from("webhook_logs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", yesterday.toISOString()),
    supabase.from("inbound_campaign_webhook_logs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", yesterday.toISOString()),
  ]);
  const failedWebhooks = (failedLegacyWebhooks.count || 0) + (failedInboundWebhooks.count || 0);

  // Get failed AI processing calls (both legacy and inbound)
  const [failedLegacyAICalls, failedInboundAICalls] = await Promise.all([
    supabase.from("calls").select("id", { count: "exact", head: true }).eq("status", "ai_failed"),
    supabase.from("inbound_campaign_calls").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  const failedAICalls = (failedLegacyAICalls.count || 0) + (failedInboundAICalls.count || 0);

  // Get inactive inbound campaigns that have had recent webhook attempts
  const { data: inactiveCampaignsWithActivity } = await supabase
    .from("inbound_campaigns")
    .select(`
      id,
      name,
      is_active,
      inbound_campaign_webhook_logs!inner (id)
    `)
    .eq("is_active", false)
    .gte("inbound_campaign_webhook_logs.created_at", yesterday.toISOString())
    .limit(5);

  const hasAlerts = (failedWebhooks || 0) > 0 || (failedAICalls || 0) > 0 || (inactiveCampaignsWithActivity?.length || 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your call analytics platform
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Clients"
          value={totalClients}
          description="Active client accounts"
          icon={Users}
          href="/admin/clients"
        />
        <StatsCard
          title="Total Campaigns"
          value={totalCampaigns}
          description="Across all clients"
          icon={Megaphone}
          href="/admin/inbound"
        />
        <StatsCard
          title="Total Calls"
          value={totalCalls}
          description="All time"
          icon={Phone}
          href="/admin/calls"
        />
        <StatsCard
          title="Today's Calls"
          value={todayCalls || 0}
          description="Calls received today"
          icon={TrendingUp}
          href="/admin/calls"
        />
      </div>

      {/* Alerts Section */}
      {hasAlerts && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800 dark:text-amber-200">System Alerts</h3>
          </div>
          <div className="space-y-2">
            {(failedWebhooks || 0) > 0 && (
              <Link
                href="/admin/webhook-logs"
                className="flex items-center gap-3 p-3 rounded-md bg-white dark:bg-background hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900 transition-colors"
              >
                <XCircle className="h-5 w-5 text-red-500" />
                <div className="flex-1">
                  <div className="font-medium text-red-700 dark:text-red-300">
                    {failedWebhooks} Failed Webhook{failedWebhooks !== 1 ? "s" : ""} (24h)
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    Click to view and investigate failed webhook deliveries
                  </div>
                </div>
              </Link>
            )}
            {(failedAICalls || 0) > 0 && (
              <Link
                href="/admin/calls"
                className="flex items-center gap-3 p-3 rounded-md bg-white dark:bg-background hover:bg-orange-50 dark:hover:bg-orange-950/30 border border-orange-200 dark:border-orange-900 transition-colors"
              >
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div className="flex-1">
                  <div className="font-medium text-orange-700 dark:text-orange-300">
                    {failedAICalls} Call{failedAICalls !== 1 ? "s" : ""} with Failed AI Processing
                  </div>
                  <div className="text-sm text-orange-600 dark:text-orange-400">
                    These calls need attention - AI summarization failed
                  </div>
                </div>
              </Link>
            )}
            {(inactiveCampaignsWithActivity?.length || 0) > 0 && (
              <Link
                href="/admin/inbound"
                className="flex items-center gap-3 p-3 rounded-md bg-white dark:bg-background hover:bg-yellow-50 dark:hover:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 transition-colors"
              >
                <PauseCircle className="h-5 w-5 text-yellow-600" />
                <div className="flex-1">
                  <div className="font-medium text-yellow-700 dark:text-yellow-300">
                    {inactiveCampaignsWithActivity?.length} Inactive Campaign{inactiveCampaignsWithActivity?.length !== 1 ? "s" : ""} Receiving Webhooks
                  </div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">
                    Paused campaigns are still receiving webhook attempts
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-4">System Health</h3>
          {hasAlerts ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Webhook Success Rate (24h)</span>
                <span className={failedWebhooks && failedWebhooks > 0 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>
                  {failedWebhooks && failedWebhooks > 0 ? "Needs Attention" : "Healthy"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>AI Processing</span>
                <span className={failedAICalls && failedAICalls > 0 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>
                  {failedAICalls && failedAICalls > 0 ? `${failedAICalls} Failed` : "All Processed"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Active Campaigns</span>
                <span className="text-green-600 font-medium">{totalCampaigns} Total</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium">All systems operational</span>
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              href="/admin/clients"
              className="block p-3 rounded-md hover:bg-muted transition-colors"
            >
              <div className="font-medium">Add New Client</div>
              <div className="text-sm text-muted-foreground">
                Create a new client account
              </div>
            </Link>
            <Link
              href="/admin/inbound/new"
              className="block p-3 rounded-md hover:bg-muted transition-colors"
            >
              <div className="font-medium">Create Inbound Campaign</div>
              <div className="text-sm text-muted-foreground">
                Set up a new inbound campaign with webhooks
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
