"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CallCard } from "@/components/calls/call-card";
import { CallDetail } from "@/components/calls/call-detail";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Megaphone,
  Phone,
  TrendingUp,
  Clock,
  Loader2,
} from "lucide-react";
import type { Call } from "@/lib/db/schema";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";

type CallWithTag = Call & {
  campaign_outcome_tags?: {
    tag_name: string;
    tag_color: string;
    is_positive: boolean;
  } | null;
};

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface CampaignStats {
  totalCalls: number;
  completedCalls: number;
  positiveOutcomes: number;
  avgDuration: number;
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats>({
    totalCalls: 0,
    completedCalls: 0,
    positiveOutcomes: 0,
    avgDuration: 0,
  });
  const [calls, setCalls] = useState<CallWithTag[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallWithTag | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [outcomeTags, setOutcomeTags] = useState<{ id: string; tag_name: string }[]>([]);
  const supabase = createClient();
  const pageSize = 20;

  // Fetch campaign info and outcome tags
  useEffect(() => {
    async function fetchCampaignInfo() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          router.push("/login");
          return;
        }

        // Get client
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("email", user.email)
          .single();

        if (!client) {
          router.push("/dashboard");
          return;
        }

        // Get campaign (verify it belongs to this client)
        const { data: campaignData } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaignId)
          .eq("client_id", client.id)
          .single();

        if (!campaignData) {
          router.push("/dashboard/campaigns");
          return;
        }

        setCampaign(campaignData);

        // Get outcome tags
        const { data: tags } = await supabase
          .from("campaign_outcome_tags")
          .select("id, tag_name")
          .eq("campaign_id", campaignId)
          .order("sort_order");

        setOutcomeTags(tags || []);
      } catch (error) {
        console.error("Error fetching campaign:", error);
      }
    }

    fetchCampaignInfo();
  }, [campaignId, supabase, router]);

  // Fetch calls
  useEffect(() => {
    async function fetchCalls() {
      if (!campaign) return;

      setIsLoading(true);
      try {
        // Build query
        let query = supabase
          .from("calls")
          .select(
            `
            *,
            campaign_outcome_tags (
              tag_name,
              tag_color,
              is_positive
            )
          `,
            { count: "exact" }
          )
          .eq("campaign_id", campaignId)
          .eq("status", "completed");

        // Apply sentiment filter
        if (sentimentFilter !== "all") {
          query = query.eq("ai_sentiment", sentimentFilter);
        }

        // Apply outcome filter
        if (outcomeFilter !== "all") {
          query = query.eq("ai_outcome_tag_id", outcomeFilter);
        }

        // Apply date range filter
        if (dateRange?.from) {
          query = query.gte("created_at", dateRange.from.toISOString());
        }
        if (dateRange?.to) {
          const endDate = new Date(dateRange.to);
          endDate.setDate(endDate.getDate() + 1);
          query = query.lt("created_at", endDate.toISOString());
        }

        // Apply search
        if (searchQuery) {
          query = query.or(
            `transcript.ilike.%${searchQuery}%,caller_phone.ilike.%${searchQuery}%`
          );
        }

        // Apply sorting
        switch (sortBy) {
          case "date_asc":
            query = query.order("created_at", { ascending: true });
            break;
          case "duration_desc":
            query = query.order("call_duration", { ascending: false });
            break;
          case "duration_asc":
            query = query.order("call_duration", { ascending: true });
            break;
          default:
            query = query.order("created_at", { ascending: false });
        }

        // Apply pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) {
          console.error("Error fetching calls:", error);
          return;
        }

        setCalls(data || []);
        setTotalPages(Math.ceil((count || 0) / pageSize));

        // Calculate stats from all calls (without pagination)
        const { data: allCalls } = await supabase
          .from("calls")
          .select(`
            status,
            call_duration,
            campaign_outcome_tags (is_positive)
          `)
          .eq("campaign_id", campaignId);

        if (allCalls) {
          const completed = allCalls.filter((c) => c.status === "completed");
          const positive = allCalls.filter(
            (c) => (c.campaign_outcome_tags as { is_positive?: boolean })?.is_positive === true
          );
          const totalDuration = completed.reduce(
            (sum, c) => sum + (c.call_duration || 0),
            0
          );

          setStats({
            totalCalls: allCalls.length,
            completedCalls: completed.length,
            positiveOutcomes: positive.length,
            avgDuration: completed.length > 0 ? totalDuration / completed.length : 0,
          });
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCalls();
  }, [campaign, campaignId, supabase, page, sentimentFilter, outcomeFilter, dateRange, sortBy, searchQuery]);

  const handleCallClick = (call: CallWithTag) => {
    setSelectedCall(call);
    setIsDetailOpen(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!campaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const successRate = stats.completedCalls > 0
    ? Math.round((stats.positiveOutcomes / stats.completedCalls) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/campaigns">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
            {campaign.description && (
              <p className="text-muted-foreground">{campaign.description}</p>
            )}
          </div>
        </div>
        <Badge variant={campaign.is_active ? "success" : "secondary"} className="mt-1">
          {campaign.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Total Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalCalls}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completedCalls} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Positive Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.positiveOutcomes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {successRate}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatDuration(stats.avgDuration)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per completed call
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {format(new Date(campaign.created_at), "MMM d, yyyy")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Campaign start date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Calls</CardTitle>
          <CardDescription>
            All calls received for this campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone or transcript..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={(range) => {
                setDateRange(range);
                setPage(1);
              }}
            />
            <Select
              value={sentimentFilter}
              onValueChange={(value) => {
                setSentimentFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
            {outcomeTags.length > 0 && (
              <Select
                value={outcomeFilter}
                onValueChange={(value) => {
                  setOutcomeFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  {outcomeTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.tag_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={sortBy}
              onValueChange={(value) => {
                setSortBy(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest First</SelectItem>
                <SelectItem value="date_asc">Oldest First</SelectItem>
                <SelectItem value="duration_desc">Longest First</SelectItem>
                <SelectItem value="duration_asc">Shortest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Call List */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : calls.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {calls.map((call) => (
                  <CallCard
                    key={call.id}
                    call={call}
                    onClick={() => handleCallClick(call)}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Phone className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 font-semibold">No calls found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || sentimentFilter !== "all" || outcomeFilter !== "all" || dateRange
                  ? "Try adjusting your filters"
                  : "Calls will appear here once received via webhook"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Detail Modal */}
      {selectedCall && (
        <CallDetail
          call={selectedCall as CallWithTag & Record<string, unknown>}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
        />
      )}
    </div>
  );
}
