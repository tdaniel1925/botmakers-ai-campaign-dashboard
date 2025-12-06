"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  Square,
  Phone,
  Users,
  Clock,
  DollarSign,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow, subDays } from "date-fns";

interface CampaignDetails {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "stopped" | "completed";
  total_contacts: number;
  contacts_completed: number;
  is_test_mode: boolean;
  created_at: string;
  launched_at: string | null;
  campaign_schedules: Array<{
    days_of_week: number[];
    start_time: string;
    end_time: string;
    timezone: string;
  }>;
  stats: {
    totalCalls: number;
    positiveCalls: number;
    positiveRate: number;
    totalMinutes: number;
    totalCost: number;
  };
}

interface AnalyticsData {
  summary: {
    totalCalls: number;
    answeredCalls: number;
    unansweredCalls: number;
    positiveCalls: number;
    negativeCalls: number;
    positiveRate: number;
    totalMinutes: number;
    totalCost: number;
    avgCallDuration: number;
    totalSms: number;
    deliveredSms: number;
    smsDeliveryRate: number;
    contactsRemaining: number;
    progress: number;
  };
  charts: {
    callsOverTime: Array<{ date: string; calls: number }>;
    outcomesByDate: Array<{ date: string; positive: number; negative: number }>;
    callsByHour: Array<{ hour: number; calls: number }>;
    outcomeDistribution: Array<{ name: string; value: number; color: string }>;
  };
}

export default function ClientCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [dateRange, setDateRange] = useState("7");

  const { toast } = useToast();

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/client/outbound-campaigns/${id}`);
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
    }
  };

  const fetchAnalytics = async () => {
    try {
      const startDate = format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");
      const endDate = format(new Date(), "yyyy-MM-dd");

      const response = await fetch(
        `/api/client/outbound-campaigns/${id}/activity?start_date=${startDate}&end_date=${endDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch analytics");
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchCampaign(), fetchAnalytics()]);
      setIsLoading(false);
    };
    loadData();
  }, [id]);

  useEffect(() => {
    if (campaign) {
      fetchAnalytics();
    }
  }, [dateRange]);

  const handleAction = async (action: "pause" | "resume" | "stop") => {
    setIsActionLoading(true);
    try {
      const response = await fetch(`/api/client/outbound-campaigns/${id}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} campaign`);
      }
      toast({
        title: "Success",
        description: `Campaign ${action === "pause" ? "paused" : action === "resume" ? "resumed" : "stopped"} successfully`,
      });
      fetchCampaign();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} campaign`,
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "paused":
        return <Badge variant="warning">Paused</Badge>;
      case "stopped":
        return <Badge variant="destructive">Stopped</Badge>;
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

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
          <Link href="/dashboard/outbound">Back to Campaigns</Link>
        </Button>
      </div>
    );
  }

  const progress = campaign.total_contacts > 0
    ? Math.round((campaign.contacts_completed / campaign.total_contacts) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/outbound">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
              {campaign.is_test_mode && <Badge variant="outline">Test Mode</Badge>}
            </div>
            {campaign.description && (
              <p className="text-muted-foreground">{campaign.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === "active" && (
            <Button variant="outline" onClick={() => handleAction("pause")} disabled={isActionLoading}>
              {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
          {campaign.status === "paused" && (
            <>
              <Button variant="outline" onClick={() => handleAction("resume")} disabled={isActionLoading}>
                {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Play className="mr-2 h-4 w-4" />
                Resume
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isActionLoading}>
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Stop Campaign?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently stop the campaign. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleAction("stop")}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Stop Campaign
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progress
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress}%</div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {campaign.contacts_completed} of {campaign.total_contacts} contacts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Calls
            </CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.stats.totalCalls}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.stats.totalMinutes.toFixed(1)} minutes total
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
              {campaign.stats.positiveRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {campaign.stats.positiveCalls} positive calls
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cost
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${campaign.stats.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.launched_at && (
                <>Since {format(new Date(campaign.launched_at), "MMM d")}</>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="analytics">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="calls" asChild>
              <Link href={`/dashboard/outbound/${id}/calls`}>
                <Phone className="mr-2 h-4 w-4" />
                Call Logs
              </Link>
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchAnalytics}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          {analytics ? (
            <>
              {/* Outcome Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Outcome Distribution</CardTitle>
                  <CardDescription>Breakdown of call outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {analytics.charts.outcomeDistribution.map((outcome) => (
                      <div
                        key={outcome.name}
                        className="p-4 rounded-lg"
                        style={{ backgroundColor: `${outcome.color}20` }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {outcome.name === "Positive" ? (
                            <CheckCircle2 className="h-5 w-5" style={{ color: outcome.color }} />
                          ) : outcome.name === "Negative" ? (
                            <XCircle className="h-5 w-5" style={{ color: outcome.color }} />
                          ) : (
                            <Phone className="h-5 w-5" style={{ color: outcome.color }} />
                          )}
                          <span className="font-medium">{outcome.name}</span>
                        </div>
                        <div className="text-3xl font-bold" style={{ color: outcome.color }}>
                          {outcome.value}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {analytics.summary.totalCalls > 0
                            ? ((outcome.value / analytics.summary.totalCalls) * 100).toFixed(1)
                            : 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Calls Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle>Calls Over Time</CardTitle>
                  <CardDescription>Daily call volume</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.charts.callsOverTime.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.charts.callsOverTime.slice(-14).map((day) => (
                        <div key={day.date} className="flex items-center gap-4">
                          <div className="w-20 text-sm text-muted-foreground">
                            {format(new Date(day.date), "MMM d")}
                          </div>
                          <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{
                                width: `${
                                  (day.calls /
                                    Math.max(...analytics.charts.callsOverTime.map((d) => d.calls), 1)) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                          <div className="w-12 text-sm font-medium text-right">{day.calls}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No call data for this period
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Calls by Hour */}
              <Card>
                <CardHeader>
                  <CardTitle>Calls by Hour</CardTitle>
                  <CardDescription>Call distribution throughout the day</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-1 h-32">
                    {analytics.charts.callsByHour.map((hour) => {
                      const maxCalls = Math.max(...analytics.charts.callsByHour.map((h) => h.calls), 1);
                      const height = maxCalls > 0 ? (hour.calls / maxCalls) * 100 : 0;
                      return (
                        <div key={hour.hour} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                            style={{ height: `${height}%` }}
                            title={`${hour.calls} calls`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {hour.hour}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* SMS Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>SMS Follow-ups</CardTitle>
                  <CardDescription>Automated message statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <div className="text-2xl font-bold">{analytics.summary.totalSms}</div>
                      <div className="text-sm text-muted-foreground">Total Sent</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <div className="text-2xl font-bold">{analytics.summary.deliveredSms}</div>
                      <div className="text-sm text-muted-foreground">Delivered</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <div className="text-2xl font-bold">{analytics.summary.smsDeliveryRate.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Delivery Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Schedule Info */}
      {campaign.campaign_schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Call Schedule</CardTitle>
            <CardDescription>When calls are being made</CardDescription>
          </CardHeader>
          <CardContent>
            {campaign.campaign_schedules.map((schedule, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {schedule.days_of_week
                      .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
                      .join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {schedule.start_time} - {schedule.end_time} ({schedule.timezone})
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
