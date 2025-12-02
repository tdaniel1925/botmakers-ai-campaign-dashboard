"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Loader2, ArrowLeft, Phone, Clock, TrendingUp, MessageSquare, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface CampaignStats {
  totalCalls: number;
  completedCalls: number;
  avgDuration: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  outcomeDistribution: Array<{
    tagName: string;
    tagColor: string;
    count: number;
  }>;
  callsOverTime: Array<{
    date: string;
    count: number;
  }>;
  topKeywords: Array<{
    word: string;
    count: number;
  }>;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  clients?: { name: string; company_name?: string };
}

export default function CampaignAnalyticsPage() {
  const params = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [period, setPeriod] = useState<string>("30d");
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch campaign details
        const campaignRes = await fetch(`/api/admin/campaigns/${params.id}`);
        if (campaignRes.ok) {
          const campaignData = await campaignRes.json();
          setCampaign(campaignData);
        }

        // Fetch analytics data
        const fromDate = dateRange.from ? startOfDay(dateRange.from) : subDays(new Date(), 30);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : new Date();

        // Get calls for this campaign
        const { data: calls, error: callsError } = await supabase
          .from("calls")
          .select(`
            id,
            call_duration,
            ai_sentiment,
            outcome_tag_id,
            created_at,
            transcript,
            campaign_outcome_tags (
              tag_name,
              tag_color
            )
          `)
          .eq("campaign_id", params.id)
          .eq("status", "completed")
          .gte("created_at", fromDate.toISOString())
          .lte("created_at", toDate.toISOString());

        if (callsError) throw callsError;

        // Calculate stats
        const totalCalls = calls?.length || 0;
        const completedCalls = calls?.filter(c => c.ai_sentiment !== null).length || 0;
        const totalDuration = calls?.reduce((sum, c) => sum + (c.call_duration || 0), 0) || 0;
        const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

        // Sentiment breakdown
        const sentimentBreakdown = {
          positive: calls?.filter(c => c.ai_sentiment === "positive").length || 0,
          neutral: calls?.filter(c => c.ai_sentiment === "neutral").length || 0,
          negative: calls?.filter(c => c.ai_sentiment === "negative").length || 0,
        };

        // Outcome distribution
        const outcomeMap = new Map<string, { tagName: string; tagColor: string; count: number }>();
        calls?.forEach(call => {
          if (call.campaign_outcome_tags) {
            // Handle both single object and array formats from Supabase
            const tagData = call.campaign_outcome_tags as unknown;
            const tag = Array.isArray(tagData) && tagData.length > 0
              ? tagData[0] as { tag_name: string; tag_color: string }
              : tagData as { tag_name: string; tag_color: string };
            if (tag && tag.tag_name) {
              const existing = outcomeMap.get(tag.tag_name);
              if (existing) {
                existing.count++;
              } else {
                outcomeMap.set(tag.tag_name, {
                  tagName: tag.tag_name,
                  tagColor: tag.tag_color,
                  count: 1,
                });
              }
            }
          }
        });
        const outcomeDistribution = Array.from(outcomeMap.values())
          .sort((a, b) => b.count - a.count);

        // Calls over time (group by day)
        const callsByDate = new Map<string, number>();
        calls?.forEach(call => {
          const date = format(new Date(call.created_at), "yyyy-MM-dd");
          callsByDate.set(date, (callsByDate.get(date) || 0) + 1);
        });
        const callsOverTime = Array.from(callsByDate.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Simple keyword extraction from transcripts
        const wordCounts = new Map<string, number>();
        const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "and", "or", "but", "if", "then", "else", "when", "at", "by", "for", "with", "about", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "once", "here", "there", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "just", "i", "you", "he", "she", "it", "we", "they", "what", "which", "who", "this", "that", "these", "those", "am", "of", "as"]);

        calls?.forEach(call => {
          if (call.transcript) {
            const words = call.transcript.toLowerCase()
              .replace(/[^a-z\s]/g, "")
              .split(/\s+/)
              .filter((w: string) => w.length > 3 && !stopWords.has(w));
            words.forEach((word: string) => {
              wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            });
          }
        });
        const topKeywords = Array.from(wordCounts.entries())
          .map(([word, count]) => ({ word, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        setStats({
          totalCalls,
          completedCalls,
          avgDuration,
          sentimentBreakdown,
          outcomeDistribution,
          callsOverTime,
          topKeywords,
        });
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [params.id, dateRange, supabase]);

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    const now = new Date();
    switch (value) {
      case "7d":
        setDateRange({ from: subDays(now, 7), to: now });
        break;
      case "30d":
        setDateRange({ from: subDays(now, 30), to: now });
        break;
      case "90d":
        setDateRange({ from: subDays(now, 90), to: now });
        break;
      case "all":
        setDateRange({ from: subDays(now, 365), to: now });
        break;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/admin/campaigns/${params.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Campaign Analytics</h1>
            <p className="text-muted-foreground">
              {campaign?.name} - Performance insights
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={(range) => {
              if (range) {
                setDateRange(range);
                setPeriod("custom");
              }
            }}
          />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCalls || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.completedCalls || 0} analyzed by AI
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(stats?.avgDuration || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              per call
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.totalCalls
                ? Math.round((stats.sentimentBreakdown.positive / stats.totalCalls) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.sentimentBreakdown.positive || 0} positive calls
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outcome Tags</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.outcomeDistribution.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              unique outcomes
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sentiment Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Distribution</CardTitle>
            <CardDescription>AI-analyzed call sentiment breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats && stats.totalCalls > 0 && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                        Positive
                      </span>
                      <span>{stats.sentimentBreakdown.positive} ({Math.round((stats.sentimentBreakdown.positive / stats.totalCalls) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(stats.sentimentBreakdown.positive / stats.totalCalls) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
                        Neutral
                      </span>
                      <span>{stats.sentimentBreakdown.neutral} ({Math.round((stats.sentimentBreakdown.neutral / stats.totalCalls) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-gray-400 h-2 rounded-full"
                        style={{ width: `${(stats.sentimentBreakdown.neutral / stats.totalCalls) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                        Negative
                      </span>
                      <span>{stats.sentimentBreakdown.negative} ({Math.round((stats.sentimentBreakdown.negative / stats.totalCalls) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${(stats.sentimentBreakdown.negative / stats.totalCalls) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </>
              )}
              {(!stats || stats.totalCalls === 0) && (
                <p className="text-muted-foreground text-center py-8">No call data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Outcome Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Outcome Distribution</CardTitle>
            <CardDescription>Calls by assigned outcome tag</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.outcomeDistribution.map((outcome, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: outcome.tagColor }}
                    ></span>
                    <span className="text-sm">{outcome.tagName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          backgroundColor: outcome.tagColor,
                          width: `${(outcome.count / (stats?.totalCalls || 1)) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {outcome.count}
                    </span>
                  </div>
                </div>
              ))}
              {(!stats?.outcomeDistribution || stats.outcomeDistribution.length === 0) && (
                <p className="text-muted-foreground text-center py-8">No outcomes tagged yet</p>
              )}
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
            {stats?.callsOverTime && stats.callsOverTime.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-end gap-1 h-32">
                  {stats.callsOverTime.slice(-14).map((day, index) => {
                    const maxCount = Math.max(...stats.callsOverTime.map(d => d.count));
                    const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                    return (
                      <div
                        key={index}
                        className="flex-1 bg-primary/20 rounded-t relative group"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      >
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-primary rounded-t transition-all"
                          style={{ height: `${height}%` }}
                        ></div>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                          {day.count} calls
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{stats.callsOverTime.length > 0 ? format(new Date(stats.callsOverTime[Math.max(0, stats.callsOverTime.length - 14)].date), "MMM d") : ""}</span>
                  <span>{stats.callsOverTime.length > 0 ? format(new Date(stats.callsOverTime[stats.callsOverTime.length - 1].date), "MMM d") : ""}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No call data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Keywords */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Top Keywords
            </CardTitle>
            <CardDescription>Most frequent words in transcripts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats?.topKeywords.map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/10 text-primary"
                  style={{
                    fontSize: `${Math.max(0.75, Math.min(1.25, 0.75 + (keyword.count / (stats.topKeywords[0]?.count || 1)) * 0.5))}rem`,
                  }}
                >
                  {keyword.word}
                  <span className="ml-1 text-xs text-muted-foreground">({keyword.count})</span>
                </span>
              ))}
              {(!stats?.topKeywords || stats.topKeywords.length === 0) && (
                <p className="text-muted-foreground text-center py-8 w-full">No transcript data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
