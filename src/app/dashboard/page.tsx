import { db } from '@/db';
import { campaigns, interactions, smsLogs, organizations } from '@/db/schema';
import { count, eq, and, gte } from 'drizzle-orm';
import { requireFullAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Megaphone, MessageSquare, Send, PhoneIncoming, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

async function getClientData(organizationId: string) {
  // Get organization
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  // Get campaigns for this organization
  const orgCampaigns = await db.query.campaigns.findMany({
    where: and(
      eq(campaigns.organizationId, organizationId),
      eq(campaigns.isActive, true)
    ),
  });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get stats for all campaigns
  const campaignIds = orgCampaigns.map(c => c.id);

  if (campaignIds.length === 0) {
    return {
      organization,
      campaigns: orgCampaigns,
      stats: {
        totalInteractions: 0,
        todayInteractions: 0,
        weekInteractions: 0,
        monthInteractions: 0,
        totalSmsSent: 0,
        smsDelivered: 0,
        completedCalls: 0,
        totalCalls: 0,
      },
      recentInteractions: [],
    };
  }

  // Get interactions for these campaigns
  const [
    totalInteractions,
    todayInteractions,
    weekInteractions,
    monthInteractions,
    completedCalls,
    totalCalls,
  ] = await Promise.all([
    db.select({ count: count() }).from(interactions)
      .where(eq(interactions.campaignId, campaignIds[0])), // TODO: handle multiple campaigns
    db.select({ count: count() }).from(interactions)
      .where(and(
        eq(interactions.campaignId, campaignIds[0]),
        gte(interactions.createdAt, startOfDay)
      )),
    db.select({ count: count() }).from(interactions)
      .where(and(
        eq(interactions.campaignId, campaignIds[0]),
        gte(interactions.createdAt, startOfWeek)
      )),
    db.select({ count: count() }).from(interactions)
      .where(and(
        eq(interactions.campaignId, campaignIds[0]),
        gte(interactions.createdAt, startOfMonth)
      )),
    db.select({ count: count() }).from(interactions)
      .where(and(
        eq(interactions.campaignId, campaignIds[0]),
        eq(interactions.callStatus, 'completed')
      )),
    db.select({ count: count() }).from(interactions)
      .where(and(
        eq(interactions.campaignId, campaignIds[0]),
        eq(interactions.sourceType, 'phone')
      )),
  ]);

  // Get recent interactions
  const recentInteractions = await db.query.interactions.findMany({
    where: eq(interactions.campaignId, campaignIds[0]),
    limit: 5,
    orderBy: (interactions, { desc }) => [desc(interactions.createdAt)],
    with: {
      campaign: true,
    },
  });

  return {
    organization,
    campaigns: orgCampaigns,
    stats: {
      totalInteractions: totalInteractions[0]?.count || 0,
      todayInteractions: todayInteractions[0]?.count || 0,
      weekInteractions: weekInteractions[0]?.count || 0,
      monthInteractions: monthInteractions[0]?.count || 0,
      totalSmsSent: 0, // TODO: calculate from smsLogs
      smsDelivered: 0,
      completedCalls: completedCalls[0]?.count || 0,
      totalCalls: totalCalls[0]?.count || 0,
    },
    recentInteractions,
  };
}

export default async function ClientDashboard() {
  const user = await requireFullAuth();
  const data = await getClientData(user.organizationId!);

  const completionRate = data.stats.totalCalls > 0
    ? Math.round((data.stats.completedCalls / data.stats.totalCalls) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{data.organization?.name}</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your campaigns.
          </p>
        </div>
      </div>

      {data.campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Campaigns Yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Your administrator hasn&apos;t set up any campaigns for your organization yet.
              Please contact your administrator to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Campaign Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/dashboard/campaigns/${campaign.id}`}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-muted transition-colors"
                  >
                    <Megaphone className="h-3 w-3" />
                    {campaign.name}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.stats.totalInteractions}</div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Today</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.stats.todayInteractions}</div>
                <p className="text-xs text-muted-foreground">
                  Interactions today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">This Week</CardTitle>
                <PhoneIncoming className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.stats.weekInteractions}</div>
                <p className="text-xs text-muted-foreground">
                  Interactions this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completionRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {data.stats.completedCalls} of {data.stats.totalCalls} calls
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Interactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Interactions</CardTitle>
              <Link
                href="/dashboard/interactions"
                className="text-sm text-primary hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {data.recentInteractions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No interactions yet
                </p>
              ) : (
                <div className="space-y-4">
                  {data.recentInteractions.map((interaction) => (
                    <Link
                      key={interaction.id}
                      href={`/dashboard/interactions/${interaction.id}`}
                      className="flex items-center justify-between border-b pb-4 last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          interaction.callStatus === 'completed' ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          <PhoneIncoming className={`h-4 w-4 ${
                            interaction.callStatus === 'completed' ? 'text-green-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">{interaction.phoneNumber || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">
                            {interaction.aiSummary
                              ? interaction.aiSummary.substring(0, 50) + '...'
                              : 'No summary available'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          interaction.callStatus === 'completed' ? 'success' :
                          interaction.callStatus === 'failed' ? 'destructive' : 'secondary'
                        }>
                          {interaction.callStatus || 'pending'}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(interaction.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
