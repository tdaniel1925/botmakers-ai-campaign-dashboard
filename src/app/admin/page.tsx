import { db } from '@/db';
import { organizations, campaigns, interactions, smsLogs, users } from '@/db/schema';
import { count, eq, and, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Megaphone, MessageSquare, Users, Send, PhoneIncoming, FileText, Bot } from 'lucide-react';

async function getStats() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalOrgs,
    activeOrgs,
    totalCampaigns,
    activeCampaigns,
    totalUsers,
    totalInteractions,
    todayInteractions,
    weekInteractions,
    monthInteractions,
    totalSmsSent,
    smsDelivered,
    smsFailed,
    sourceBreakdown,
  ] = await Promise.all([
    db.select({ count: count() }).from(organizations),
    db.select({ count: count() }).from(organizations).where(eq(organizations.isActive, true)),
    db.select({ count: count() }).from(campaigns),
    db.select({ count: count() }).from(campaigns).where(eq(campaigns.isActive, true)),
    db.select({ count: count() }).from(users).where(eq(users.role, 'client_user')),
    db.select({ count: count() }).from(interactions),
    db.select({ count: count() }).from(interactions).where(gte(interactions.createdAt, startOfDay)),
    db.select({ count: count() }).from(interactions).where(gte(interactions.createdAt, startOfWeek)),
    db.select({ count: count() }).from(interactions).where(gte(interactions.createdAt, startOfMonth)),
    db.select({ count: count() }).from(smsLogs),
    db.select({ count: count() }).from(smsLogs).where(eq(smsLogs.status, 'delivered')),
    db.select({ count: count() }).from(smsLogs).where(eq(smsLogs.status, 'failed')),
    db.select({
      sourceType: interactions.sourceType,
      count: count(),
    })
      .from(interactions)
      .groupBy(interactions.sourceType),
  ]);

  return {
    totalOrgs: totalOrgs[0]?.count || 0,
    activeOrgs: activeOrgs[0]?.count || 0,
    totalCampaigns: totalCampaigns[0]?.count || 0,
    activeCampaigns: activeCampaigns[0]?.count || 0,
    totalUsers: totalUsers[0]?.count || 0,
    totalInteractions: totalInteractions[0]?.count || 0,
    todayInteractions: todayInteractions[0]?.count || 0,
    weekInteractions: weekInteractions[0]?.count || 0,
    monthInteractions: monthInteractions[0]?.count || 0,
    totalSmsSent: totalSmsSent[0]?.count || 0,
    smsDelivered: smsDelivered[0]?.count || 0,
    smsFailed: smsFailed[0]?.count || 0,
    sourceBreakdown,
  };
}

async function getRecentInteractions() {
  return db.query.interactions.findMany({
    limit: 10,
    orderBy: (interactions, { desc }) => [desc(interactions.createdAt)],
    with: {
      campaign: {
        with: {
          organization: true,
        },
      },
    },
  });
}

export default async function AdminDashboard() {
  const stats = await getStats();
  const recentInteractions = await getRecentInteractions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of all clients, campaigns, and interactions
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrgs}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeOrgs} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeCampaigns} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Client Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Across all organizations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">SMS Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSmsSent}</div>
            <p className="text-xs text-muted-foreground">
              {stats.smsDelivered} delivered, {stats.smsFailed} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interaction Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayInteractions}</div>
            <p className="text-xs text-muted-foreground">Interactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weekInteractions}</div>
            <p className="text-xs text-muted-foreground">Interactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.monthInteractions}</div>
            <p className="text-xs text-muted-foreground">Interactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Source Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Interactions by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {['phone', 'sms', 'web_form', 'chatbot'].map((source) => {
              const data = stats.sourceBreakdown.find((s) => s.sourceType === source);
              const count = data?.count || 0;
              const icon = source === 'phone' ? PhoneIncoming :
                          source === 'sms' ? MessageSquare :
                          source === 'web_form' ? FileText : Bot;
              const Icon = icon;
              return (
                <div key={source} className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {source.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Interactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Interactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentInteractions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No interactions yet. Interactions will appear here when webhooks are received.
            </p>
          ) : (
            <div className="space-y-4">
              {recentInteractions.map((interaction) => (
                <div
                  key={interaction.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      interaction.sourceType === 'phone' ? 'bg-blue-100' :
                      interaction.sourceType === 'sms' ? 'bg-green-100' :
                      interaction.sourceType === 'web_form' ? 'bg-purple-100' : 'bg-orange-100'
                    }`}>
                      {interaction.sourceType === 'phone' ? (
                        <PhoneIncoming className="h-4 w-4 text-blue-600" />
                      ) : interaction.sourceType === 'sms' ? (
                        <MessageSquare className="h-4 w-4 text-green-600" />
                      ) : interaction.sourceType === 'web_form' ? (
                        <FileText className="h-4 w-4 text-purple-600" />
                      ) : (
                        <Bot className="h-4 w-4 text-orange-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{interaction.phoneNumber || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">
                        {interaction.campaign?.organization?.name} - {interaction.campaign?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {new Date(interaction.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {interaction.sourceType.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
