"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import type { Call } from "@/lib/db/schema";

interface DailyData {
  date: string;
  calls: number;
  positive: number;
  negative: number;
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState("7");
  const [calls, setCalls] = useState<Call[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.email) return;

        // Get client
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("email", user.email)
          .single();

        if (!client) return;

        // Get campaigns for this client
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id, name")
          .eq("client_id", client.id);

        if (!campaigns || campaigns.length === 0) {
          setIsLoading(false);
          return;
        }

        const campaignIds = campaigns.map((c) => c.id);

        // Calculate date range
        const days = parseInt(dateRange);
        const startDate = startOfDay(subDays(new Date(), days - 1));
        const endDate = endOfDay(new Date());

        // Get calls for the date range
        const { data: callsData } = await supabase
          .from("calls")
          .select(
            `
            *,
            campaigns (name),
            campaign_outcome_tags (tag_name)
          `
          )
          .in("campaign_id", campaignIds)
          .eq("status", "completed")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .order("created_at", { ascending: false });

        setCalls(callsData || []);

        // Calculate daily data
        const dailyMap = new Map<string, DailyData>();

        // Initialize all days
        for (let i = 0; i < days; i++) {
          const date = format(subDays(new Date(), i), "MMM d");
          dailyMap.set(date, { date, calls: 0, positive: 0, negative: 0 });
        }

        // Fill in call data
        (callsData || []).forEach((call) => {
          const date = format(new Date(call.created_at!), "MMM d");
          const existing = dailyMap.get(date);
          if (existing) {
            existing.calls++;
            if (call.ai_sentiment === "positive") existing.positive++;
            if (call.ai_sentiment === "negative") existing.negative++;
          }
        });

        setDailyData(Array.from(dailyMap.values()).reverse());
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [supabase, dateRange]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const headers = [
        "Call ID",
        "Date",
        "Campaign",
        "Phone",
        "Duration (sec)",
        "Outcome",
        "Sentiment",
        "Summary",
        "Transcript",
      ];

      const rows = calls.map((call) => [
        call.id,
        call.callTimestamp
          ? format(new Date(call.callTimestamp), "yyyy-MM-dd HH:mm:ss")
          : format(new Date(call.createdAt!), "yyyy-MM-dd HH:mm:ss"),
        (call as Call & { campaigns?: { name: string } }).campaigns?.name || "",
        call.callerPhone || "",
        call.callDuration?.toString() || "",
        (call as Call & { campaign_outcome_tags?: { tag_name: string } }).campaign_outcome_tags?.tag_name || "",
        call.aiSentiment || "",
        call.aiSummary?.replace(/"/g, '""') || "",
        call.transcript.replace(/"/g, '""'),
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${cell}"`).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `calls-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();

      toast({
        title: "Export complete",
        description: `Exported ${calls.length} calls to CSV`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const totalCalls = calls.length;
  const positiveCalls = calls.filter((c) => c.aiSentiment === "positive").length;
  const negativeCalls = calls.filter((c) => c.aiSentiment === "negative").length;
  const avgDuration =
    calls.length > 0
      ? Math.round(
          calls.reduce((sum, c) => sum + (c.callDuration || 0), 0) / calls.length
        )
      : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            View analytics and export your call data
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Label>Date Range:</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleExportCSV} disabled={isExporting || calls.length === 0}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCalls}</div>
            <p className="text-xs text-muted-foreground">
              In the last {dateRange} days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCalls > 0
                ? `${Math.round((positiveCalls / totalCalls) * 100)}%`
                : "0%"}
            </div>
            <p className="text-xs text-muted-foreground">
              {positiveCalls} positive calls
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCalls > 0
                ? `${Math.round((negativeCalls / totalCalls) * 100)}%`
                : "0%"}
            </div>
            <p className="text-xs text-muted-foreground">
              {negativeCalls} negative calls
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(avgDuration / 60)}:{(avgDuration % 60)
                .toString()
                .padStart(2, "0")}
            </div>
            <p className="text-xs text-muted-foreground">Minutes per call</p>
          </CardContent>
        </Card>
      </div>

      {/* Call Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Call Volume Trends</CardTitle>
          <CardDescription>
            Daily call volume and sentiment breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="calls"
                  name="Total Calls"
                  stroke="#2563eb"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="positive"
                  name="Positive"
                  stroke="#22c55e"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="negative"
                  name="Negative"
                  stroke="#ef4444"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Info */}
      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>
            Download your call data for further analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export includes: Call ID, Date, Campaign, Phone Number, Duration,
              Outcome, Sentiment, AI Summary, and Full Transcript.
            </p>
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleExportCSV}
                disabled={isExporting || calls.length === 0}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                Download CSV ({calls.length} calls)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
