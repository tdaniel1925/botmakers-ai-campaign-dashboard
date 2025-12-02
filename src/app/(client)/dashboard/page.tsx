"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  TrendingUp,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ArrowRight,
  Megaphone,
  Activity,
  BarChart3,
  Zap,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  AreaChart,
  CartesianGrid,
} from "recharts";

interface ClientInfo {
  name: string;
  companyName: string | null;
}

interface Campaign {
  id: string;
  name: string;
  is_active: boolean;
  call_count: number;
  positive_rate: number;
}

interface Stats {
  totalCalls: number;
  todayCalls: number;
  avgDuration: number;
  positiveCalls: number;
  negativeCalls: number;
  neutralCalls: number;
  outcomeBreakdown: { name: string; value: number; color: string }[];
  recentCampaigns: Campaign[];
  weeklyData: { day: string; calls: number }[];
}

const SENTIMENT_COLORS = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#94a3b8",
};

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-20 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalCalls: 0,
    todayCalls: 0,
    avgDuration: 0,
    positiveCalls: 0,
    negativeCalls: 0,
    neutralCalls: 0,
    outcomeBreakdown: [],
    recentCampaigns: [],
    weeklyData: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchStats() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.email) return;

        const { data: client } = await supabase
          .from("clients")
          .select("id, name, company_name")
          .eq("email", user.email)
          .single();

        if (!client) return;

        setClientInfo({
          name: client.name,
          companyName: client.company_name,
        });

        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id, name, is_active")
          .eq("client_id", client.id);

        if (!campaigns || campaigns.length === 0) {
          setIsLoading(false);
          return;
        }

        const campaignIds = campaigns.map((c) => c.id);

        const { data: calls } = await supabase
          .from("calls")
          .select(
            `
            id,
            call_duration,
            ai_sentiment,
            ai_outcome_tag_id,
            created_at,
            campaign_id,
            campaign_outcome_tags (
              tag_name,
              tag_color
            )
          `
          )
          .in("campaign_id", campaignIds)
          .eq("status", "completed");

        if (!calls) {
          setIsLoading(false);
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayCalls = calls.filter(
          (c) => new Date(c.created_at) >= today
        ).length;

        const avgDuration =
          calls.length > 0
            ? Math.round(
                calls.reduce((sum, c) => sum + (c.call_duration || 0), 0) /
                  calls.length
              )
            : 0;

        const positiveCalls = calls.filter(
          (c) => c.ai_sentiment === "positive"
        ).length;
        const negativeCalls = calls.filter(
          (c) => c.ai_sentiment === "negative"
        ).length;
        const neutralCalls = calls.filter(
          (c) => c.ai_sentiment === "neutral"
        ).length;

        const outcomeCounts: Record<string, { count: number; color: string }> = {};
        calls.forEach((call) => {
          const outcomeTag = call.campaign_outcome_tags as unknown as { tag_name: string; tag_color: string } | null;
          const tagName = outcomeTag?.tag_name || "Unknown";
          const tagColor = outcomeTag?.tag_color || "#94a3b8";
          if (!outcomeCounts[tagName]) {
            outcomeCounts[tagName] = { count: 0, color: tagColor };
          }
          outcomeCounts[tagName].count++;
        });

        const outcomeBreakdown = Object.entries(outcomeCounts)
          .map(([name, { count, color }]) => ({
            name,
            value: count,
            color,
          }))
          .sort((a, b) => b.value - a.value);

        // Calculate campaign stats
        const recentCampaigns: Campaign[] = campaigns.slice(0, 5).map((campaign) => {
          const campaignCalls = calls.filter((c) => c.campaign_id === campaign.id);
          const positiveCampaignCalls = campaignCalls.filter(
            (c) => c.ai_sentiment === "positive"
          ).length;
          return {
            id: campaign.id,
            name: campaign.name,
            is_active: campaign.is_active,
            call_count: campaignCalls.length,
            positive_rate: campaignCalls.length > 0
              ? Math.round((positiveCampaignCalls / campaignCalls.length) * 100)
              : 0,
          };
        });

        // Weekly data (last 7 days)
        const weeklyData: { day: string; calls: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);

          const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
          const dayCalls = calls.filter((c) => {
            const callDate = new Date(c.created_at);
            return callDate >= date && callDate < nextDay;
          }).length;

          weeklyData.push({ day: dayName, calls: dayCalls });
        }

        setStats({
          totalCalls: calls.length,
          todayCalls,
          avgDuration,
          positiveCalls,
          negativeCalls,
          neutralCalls,
          outcomeBreakdown,
          recentCampaigns,
          weeklyData,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();

    const channel = supabase
      .channel("calls-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const sentimentData = [
    { name: "Positive", value: stats.positiveCalls, color: SENTIMENT_COLORS.positive },
    { name: "Negative", value: stats.negativeCalls, color: SENTIMENT_COLORS.negative },
    { name: "Neutral", value: stats.neutralCalls, color: SENTIMENT_COLORS.neutral },
  ].filter((d) => d.value > 0);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const getWelcomeName = () => {
    if (!clientInfo) return "";
    const firstName = clientInfo.name?.split(" ")[0];
    if (firstName) return firstName;
    if (clientInfo.companyName) return clientInfo.companyName;
    return "";
  };

  const positiveRate = stats.totalCalls > 0
    ? Math.round((stats.positiveCalls / stats.totalCalls) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{getWelcomeName() ? `, ${getWelcomeName()}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your call analytics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Calls
            </CardTitle>
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/20 p-2">
              <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All time completed calls
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today&apos;s Calls
            </CardTitle>
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/20 p-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.todayCalls}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Since midnight
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600" />
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Duration
            </CardTitle>
            <div className="rounded-full bg-violet-100 dark:bg-violet-900/20 p-2">
              <Clock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatDuration(stats.avgDuration)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per completed call
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-violet-600" />
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Positive Rate
            </CardTitle>
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/20 p-2">
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{positiveRate}%</div>
            <div className="mt-2">
              <Progress value={positiveRate} className="h-2" />
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-600" />
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Weekly Activity */}
        <Card className="md:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Weekly Activity
                </CardTitle>
                <CardDescription>Call volume over the last 7 days</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {stats.weeklyData.some((d) => d.calls > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats.weeklyData}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorCalls)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[280px] text-center">
                <Activity className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No calls this week</p>
                <p className="text-sm text-muted-foreground/70">
                  Calls will appear here once received
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sentiment Distribution */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Sentiment
            </CardTitle>
            <CardDescription>Distribution of call sentiments</CardDescription>
          </CardHeader>
          <CardContent>
            {sentimentData.length > 0 ? (
              <div className="space-y-6">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Positive</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{stats.positiveCalls}</span>
                      <Badge variant="secondary" className="text-xs">
                        {stats.totalCalls > 0
                          ? Math.round((stats.positiveCalls / stats.totalCalls) * 100)
                          : 0}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Negative</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{stats.negativeCalls}</span>
                      <Badge variant="secondary" className="text-xs">
                        {stats.totalCalls > 0
                          ? Math.round((stats.negativeCalls / stats.totalCalls) * 100)
                          : 0}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-slate-400" />
                      <span className="text-sm">Neutral</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{stats.neutralCalls}</span>
                      <Badge variant="secondary" className="text-xs">
                        {stats.totalCalls > 0
                          ? Math.round((stats.neutralCalls / stats.totalCalls) * 100)
                          : 0}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[280px] text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No sentiment data</p>
                <p className="text-sm text-muted-foreground/70">
                  Sentiment analysis will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Outcome Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Outcome Breakdown</CardTitle>
            <CardDescription>Call outcomes by category</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.outcomeBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.outcomeBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis type="number" axisLine={false} tickLine={false} className="text-xs fill-muted-foreground" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    axisLine={false}
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" name="Calls" radius={[0, 4, 4, 0]}>
                    {stats.outcomeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No outcome data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Campaigns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Campaigns</CardTitle>
              <CardDescription>Your active campaigns overview</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/campaigns">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentCampaigns.length > 0 ? (
              <div className="space-y-3">
                {stats.recentCampaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/dashboard/campaigns/${campaign.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Megaphone className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.call_count} calls
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={campaign.is_active ? "default" : "secondary"}>
                        {campaign.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <div className="text-right">
                        <p className="text-sm font-medium">{campaign.positive_rate}%</p>
                        <p className="text-xs text-muted-foreground">positive</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-center">
                <Megaphone className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No campaigns yet</p>
                <p className="text-sm text-muted-foreground/70">
                  Contact your administrator to set up campaigns
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
