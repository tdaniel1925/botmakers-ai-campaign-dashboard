"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatsCard } from "@/components/shared/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, TrendingUp, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
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
  Legend,
} from "recharts";

interface ClientInfo {
  name: string;
  companyName: string | null;
}

interface Stats {
  totalCalls: number;
  todayCalls: number;
  avgDuration: number;
  positiveCalls: number;
  negativeCalls: number;
  neutralCalls: number;
  outcomeBreakdown: { name: string; value: number; color: string }[];
}

const SENTIMENT_COLORS = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#6b7280",
};

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

        // Get client
        const { data: client } = await supabase
          .from("clients")
          .select("id, name, company_name")
          .eq("email", user.email)
          .single();

        if (!client) return;

        // Set client info for welcome message
        setClientInfo({
          name: client.name,
          companyName: client.company_name,
        });

        // Get campaigns for this client
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id")
          .eq("client_id", client.id);

        if (!campaigns || campaigns.length === 0) {
          setIsLoading(false);
          return;
        }

        const campaignIds = campaigns.map((c) => c.id);

        // Get all calls for these campaigns
        const { data: calls } = await supabase
          .from("calls")
          .select(
            `
            id,
            call_duration,
            ai_sentiment,
            ai_outcome_tag_id,
            created_at,
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

        // Calculate stats
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

        // Outcome breakdown
        const outcomeCounts: Record<string, { count: number; color: string }> = {};
        calls.forEach((call) => {
          const outcomeTag = call.campaign_outcome_tags as unknown as { tag_name: string; tag_color: string } | null;
          const tagName = outcomeTag?.tag_name || "Unknown";
          const tagColor = outcomeTag?.tag_color || "#6b7280";
          if (!outcomeCounts[tagName]) {
            outcomeCounts[tagName] = { count: 0, color: tagColor };
          }
          outcomeCounts[tagName].count++;
        });

        const outcomeBreakdown = Object.entries(outcomeCounts).map(
          ([name, { count, color }]) => ({
            name,
            value: count,
            color,
          })
        );

        setStats({
          totalCalls: calls.length,
          todayCalls,
          avgDuration,
          positiveCalls,
          negativeCalls,
          neutralCalls,
          outcomeBreakdown,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();

    // Set up realtime subscription
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
  ];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Get the display name (first name or company name)
  const getWelcomeName = () => {
    if (!clientInfo) return "";
    // Try to get first name from full name
    const firstName = clientInfo.name?.split(" ")[0];
    if (firstName) return firstName;
    // Fall back to company name
    if (clientInfo.companyName) return clientInfo.companyName;
    return "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome{getWelcomeName() ? `, ${getWelcomeName()}` : ""}!
        </h1>
        <p className="text-muted-foreground">
          Overview of your call analytics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Calls"
          value={stats.totalCalls}
          description="All time"
          icon={Phone}
        />
        <StatsCard
          title="Today's Calls"
          value={stats.todayCalls}
          description="Since midnight"
          icon={TrendingUp}
        />
        <StatsCard
          title="Avg Duration"
          value={formatDuration(stats.avgDuration)}
          description="Per call"
          icon={Clock}
        />
        <StatsCard
          title="Positive Rate"
          value={
            stats.totalCalls > 0
              ? `${Math.round((stats.positiveCalls / stats.totalCalls) * 100)}%`
              : "0%"
          }
          description={`${stats.positiveCalls} positive calls`}
          icon={ThumbsUp}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.totalCalls > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No calls recorded yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outcome Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.outcomeBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.outcomeBreakdown} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Calls">
                    {stats.outcomeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No outcome data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                  <span>Positive Calls</span>
                </div>
                <span className="font-bold">{stats.positiveCalls}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                  <span>Negative Calls</span>
                </div>
                <span className="font-bold">{stats.negativeCalls}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 rounded-full bg-gray-400"></div>
                  <span>Neutral Calls</span>
                </div>
                <span className="font-bold">{stats.neutralCalls}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {stats.totalCalls > 0
                ? `You have ${stats.todayCalls} new calls today out of ${stats.totalCalls} total calls.`
                : "No calls have been recorded yet. Calls will appear here once they are received via webhook."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
