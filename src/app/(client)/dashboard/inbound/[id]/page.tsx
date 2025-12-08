"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  Phone,
  Clock,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  XCircle,
  RefreshCw,
  PhoneIncoming,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface OutcomeTag {
  id: string;
  tag_name: string;
  tag_color: string | null;
  is_positive: boolean | null;
}

interface RecentCall {
  id: string;
  caller_phone: string | null;
  status: string;
  sentiment: string | null;
  duration_seconds: number | null;
  summary: string | null;
  created_at: string;
  inbound_campaign_outcome_tags: OutcomeTag | OutcomeTag[] | null;
}

interface CampaignDetails {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  webhook_token: string;
  total_calls: number;
  calls_completed: number;
  positive_outcomes: number;
  negative_outcomes: number;
  total_minutes: string;
  created_at: string;
  updated_at: string;
  launched_at: string | null;
  inbound_campaign_outcome_tags: OutcomeTag[];
  stats: {
    totalCalls: number;
    completedCalls: number;
    positiveCalls: number;
    negativeCalls: number;
    positiveRate: number;
    totalMinutes: number;
    avgCallDuration: number;
  };
  recentCalls: RecentCall[];
}

export default function ClientInboundCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [callsFilter, setCallsFilter] = useState("all");

  const { toast } = useToast();

  const fetchCampaign = useCallback(async () => {
    try {
      const response = await fetch(`/api/client/inbound-campaigns/${id}`);
      if (!response.ok) throw new Error("Failed to fetch campaign");
      const data = await response.json();
      setCampaign(data);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      toast({
        title: "Error",
        description: "Failed to load campaign details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchCampaign();

    // Set up real-time subscriptions for live updates
    const supabase = createClient();

    const channel = supabase
      .channel(`client-inbound-campaign-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbound_campaign_calls",
          filter: `campaign_id=eq.${id}`,
        },
        () => fetchCampaign()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "inbound_campaigns",
          filter: `id=eq.${id}`,
        },
        () => fetchCampaign()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchCampaign]);

  const getOutcomeTag = (call: RecentCall): OutcomeTag | null => {
    if (!call.inbound_campaign_outcome_tags) return null;
    if (Array.isArray(call.inbound_campaign_outcome_tags)) {
      return call.inbound_campaign_outcome_tags[0] || null;
    }
    return call.inbound_campaign_outcome_tags;
  };

  const filteredCalls = campaign?.recentCalls.filter((call) => {
    if (callsFilter === "all") return true;
    if (callsFilter === "completed") return call.status === "completed";
    if (callsFilter === "positive") return call.sentiment === "positive";
    if (callsFilter === "negative") return call.sentiment === "negative";
    return true;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
        <Button asChild>
          <Link href="/dashboard/inbound">Back to Campaigns</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/inbound">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
              <Badge variant={campaign.is_active ? "success" : "secondary"}>
                {campaign.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-muted-foreground">{campaign.description}</p>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={fetchCampaign}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Calls
            </CardTitle>
            <PhoneIncoming className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.stats.totalCalls}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.stats.completedCalls} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Positive Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {campaign.stats.positiveRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              {campaign.stats.positiveCalls} positive calls
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Minutes
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.stats.totalMinutes.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {Math.floor(campaign.stats.avgCallDuration / 60)}:{String(campaign.stats.avgCallDuration % 60).padStart(2, "0")} per call
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Campaign Age
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDistanceToNow(new Date(campaign.created_at))}
            </div>
            <p className="text-xs text-muted-foreground">
              Created {format(new Date(campaign.created_at), "MMM d, yyyy")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Outcome Tags */}
      {campaign.inbound_campaign_outcome_tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Outcome Tags</CardTitle>
            <CardDescription>Tags used to categorize call outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {campaign.inbound_campaign_outcome_tags.map((tag) => (
                <Badge
                  key={tag.id}
                  style={{
                    backgroundColor: tag.tag_color || "#6b7280",
                    color: "#fff",
                  }}
                >
                  {tag.tag_name}
                  {tag.is_positive !== null && (
                    <span className="ml-1">
                      {tag.is_positive ? "(+)" : "(-)"}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Calls</CardTitle>
              <CardDescription>Last 10 calls received</CardDescription>
            </div>
            <Select value={callsFilter} onValueChange={setCallsFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Calls</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No calls to display</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCalls.map((call) => {
                const outcomeTag = getOutcomeTag(call);
                return (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        {call.status === "completed" ? (
                          call.sentiment === "positive" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : call.sentiment === "negative" ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-blue-500" />
                          )
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {call.caller_phone || "Unknown Caller"}
                          </span>
                          {outcomeTag && (
                            <Badge
                              style={{
                                backgroundColor: outcomeTag.tag_color || "#6b7280",
                                color: "#fff",
                              }}
                            >
                              {outcomeTag.tag_name}
                            </Badge>
                          )}
                          {call.sentiment && (
                            <Badge
                              variant={
                                call.sentiment === "positive"
                                  ? "default"
                                  : call.sentiment === "negative"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {call.sentiment}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          {call.duration_seconds !== null && (
                            <span>
                              {Math.floor(call.duration_seconds / 60)}:
                              {String(call.duration_seconds % 60).padStart(2, "0")}
                            </span>
                          )}
                          <span>
                            {formatDistanceToNow(new Date(call.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        {call.summary && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {call.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
