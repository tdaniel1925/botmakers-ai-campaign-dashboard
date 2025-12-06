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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  Phone,
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  MessageSquare,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { format, subDays } from "date-fns";

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
  campaign: {
    name: string;
    status: string;
    launched_at: string | null;
    is_test_mode: boolean;
  };
}

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7");

  const { toast } = useToast();

  const fetchAnalytics = async () => {
    setIsLoading(true);
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
      toast({
        title: "Error",
        description: "Failed to load analytics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [id, dateRange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Failed to load analytics</h2>
        <Button onClick={fetchAnalytics}>Retry</Button>
      </div>
    );
  }

  const { summary, charts, campaign } = analytics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/admin/outbound/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
              <Badge variant={campaign.status === "active" ? "success" : "secondary"}>
                {campaign.status}
              </Badge>
              {campaign.is_test_mode && <Badge variant="outline">Test Mode</Badge>}
            </div>
            <p className="text-muted-foreground">{campaign.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchAnalytics} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Calls
            </CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCalls}</div>
            <p className="text-xs text-muted-foreground">
              {summary.answeredCalls} answered, {summary.unansweredCalls} unanswered
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
              {summary.positiveRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.positiveCalls} positive, {summary.negativeCalls} negative
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Call Duration
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalMinutes.toFixed(1)} min</div>
            <p className="text-xs text-muted-foreground">
              Avg: {summary.avgCallDuration}s per call
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
            <div className="text-2xl font-bold">${summary.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ${summary.totalCalls > 0 ? (summary.totalCost / summary.totalCalls).toFixed(3) : "0.00"} per call
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress & SMS */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Progress</CardTitle>
            <CardDescription>Contact completion status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">{summary.progress}%</span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${summary.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{summary.contactsRemaining} contacts remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SMS Summary</CardTitle>
            <CardDescription>Follow-up message stats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{summary.totalSms}</div>
                  <div className="text-xs text-muted-foreground">Sent</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{summary.deliveredSms}</div>
                  <div className="text-xs text-muted-foreground">Delivered</div>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span>Delivery Rate</span>
                <span className="font-medium">{summary.smsDeliveryRate.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outcome Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Outcome Distribution</CardTitle>
          <CardDescription>Breakdown of call outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {charts.outcomeDistribution.map((outcome) => (
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
                  {summary.totalCalls > 0
                    ? ((outcome.value / summary.totalCalls) * 100).toFixed(1)
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
          {charts.callsOverTime.length > 0 ? (
            <div className="space-y-2">
              {charts.callsOverTime.slice(-14).map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-muted-foreground">
                    {format(new Date(day.date), "MMM d")}
                  </div>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${
                          (day.calls /
                            Math.max(...charts.callsOverTime.map((d) => d.calls), 1)) *
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
            {charts.callsByHour.map((hour) => {
              const maxCalls = Math.max(...charts.callsByHour.map((h) => h.calls), 1);
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

      {/* Outcomes by Date */}
      <Card>
        <CardHeader>
          <CardTitle>Outcomes by Date</CardTitle>
          <CardDescription>Positive vs negative outcomes over time</CardDescription>
        </CardHeader>
        <CardContent>
          {charts.outcomesByDate.length > 0 ? (
            <div className="space-y-2">
              {charts.outcomesByDate.slice(-14).map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-muted-foreground">
                    {format(new Date(day.date), "MMM d")}
                  </div>
                  <div className="flex-1 flex gap-1 h-6">
                    {day.positive > 0 && (
                      <div
                        className="h-full bg-green-500 rounded"
                        style={{
                          width: `${
                            (day.positive / (day.positive + day.negative || 1)) * 100
                          }%`,
                        }}
                        title={`${day.positive} positive`}
                      />
                    )}
                    {day.negative > 0 && (
                      <div
                        className="h-full bg-red-500 rounded"
                        style={{
                          width: `${
                            (day.negative / (day.positive + day.negative || 1)) * 100
                          }%`,
                        }}
                        title={`${day.negative} negative`}
                      />
                    )}
                    {day.positive === 0 && day.negative === 0 && (
                      <div className="h-full w-full bg-muted rounded" />
                    )}
                  </div>
                  <div className="w-20 text-sm text-right">
                    <span className="text-green-600">{day.positive}</span>
                    {" / "}
                    <span className="text-red-600">{day.negative}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No outcome data for this period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
