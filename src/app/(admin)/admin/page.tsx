import { createClient } from "@/lib/supabase/server";
import { StatsCard } from "@/components/shared/stats-card";
import { Phone, Users, Megaphone, TrendingUp } from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch stats
  const [clientsResult, campaignsResult, callsResult] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("campaigns").select("id", { count: "exact", head: true }),
    supabase.from("calls").select("id", { count: "exact", head: true }),
  ]);

  const totalClients = clientsResult.count || 0;
  const totalCampaigns = campaignsResult.count || 0;
  const totalCalls = callsResult.count || 0;

  // Get today's calls
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: todayCalls } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today.toISOString());

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
        />
        <StatsCard
          title="Total Campaigns"
          value={totalCampaigns}
          description="Across all clients"
          icon={Megaphone}
        />
        <StatsCard
          title="Total Calls"
          value={totalCalls}
          description="All time"
          icon={Phone}
        />
        <StatsCard
          title="Today's Calls"
          value={todayCalls || 0}
          description="Calls received today"
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-4">Recent Activity</h3>
          <p className="text-sm text-muted-foreground">
            Activity feed will appear here once calls start coming in.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <a
              href="/admin/clients"
              className="block p-3 rounded-md hover:bg-muted transition-colors"
            >
              <div className="font-medium">Add New Client</div>
              <div className="text-sm text-muted-foreground">
                Create a new client account
              </div>
            </a>
            <a
              href="/admin/campaigns"
              className="block p-3 rounded-md hover:bg-muted transition-colors"
            >
              <div className="font-medium">Create Campaign</div>
              <div className="text-sm text-muted-foreground">
                Set up a new campaign with webhooks
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
