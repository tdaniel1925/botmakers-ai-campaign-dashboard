"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CallCard } from "@/components/calls/call-card";
import { CallDetail } from "@/components/calls/call-detail";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useToast } from "@/hooks/use-toast";
import { Search, ChevronLeft, ChevronRight, Download, Trash2, MoreHorizontal, CheckSquare, XSquare } from "lucide-react";
import type { Call } from "@/lib/db/schema";
import type { DateRange } from "react-day-picker";

type CallWithTag = Call & {
  campaign_outcome_tags?: {
    tag_name: string;
    tag_color: string;
  } | null;
};

export default function CallsPage() {
  const [calls, setCalls] = useState<CallWithTag[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallWithTag | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const supabase = createClient();
  const { toast } = useToast();
  const pageSize = 20;

  useEffect(() => {
    async function fetchCalls() {
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
          .select("id")
          .eq("client_id", client.id);

        if (!campaigns || campaigns.length === 0) {
          setIsLoading(false);
          return;
        }

        const campaignIds = campaigns.map((c) => c.id);

        // Build query - show both completed and processing calls
        let query = supabase
          .from("calls")
          .select(
            `
            *,
            campaign_outcome_tags (
              tag_name,
              tag_color
            )
          `,
            { count: "exact" }
          )
          .in("campaign_id", campaignIds)
          .in("status", ["completed", "processing"]);

        // Apply sentiment filter
        if (sentimentFilter !== "all") {
          query = query.eq("ai_sentiment", sentimentFilter);
        }

        // Apply date range filter
        if (dateRange?.from) {
          query = query.gte("created_at", dateRange.from.toISOString());
        }
        if (dateRange?.to) {
          // Add one day to include the entire end date
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
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCalls();
  }, [supabase, page, sentimentFilter, dateRange, sortBy, searchQuery]);

  const handleCallClick = (call: CallWithTag) => {
    if (isSelectionMode) {
      handleSelectCall(call.id, !selectedCalls.has(call.id));
    } else {
      setSelectedCall(call);
      setIsDetailOpen(true);
    }
  };

  const handleSelectCall = (id: string, selected: boolean) => {
    setSelectedCalls((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedCalls.size === calls.length) {
      setSelectedCalls(new Set());
    } else {
      setSelectedCalls(new Set(calls.map((c) => c.id)));
    }
  };

  const handleExportSelected = () => {
    const selectedData = calls.filter((c) => selectedCalls.has(c.id));
    const csvContent = [
      ["Date", "Phone", "Duration", "Sentiment", "Summary", "Outcome"].join(","),
      ...selectedData.map((call) => {
        // Handle both camelCase (Drizzle) and snake_case (Supabase direct)
        const callRecord = call as unknown as Record<string, unknown>;
        const createdAt = callRecord.created_at || callRecord.createdAt;
        const callerPhone = callRecord.caller_phone || callRecord.callerPhone;
        const callDuration = callRecord.call_duration || callRecord.callDuration;
        const aiSentiment = callRecord.ai_sentiment || callRecord.aiSentiment;
        const aiSummary = callRecord.ai_summary || callRecord.aiSummary;
        return [
          createdAt ? new Date(createdAt as string).toISOString() : "",
          callerPhone || "",
          callDuration || "",
          aiSentiment || "",
          `"${(String(aiSummary || "")).replace(/"/g, '""')}"`,
          call.campaign_outcome_tags?.tag_name || "",
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `calls-export-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: `Exported ${selectedData.length} call(s) to CSV`,
    });
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedCalls(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calls</h1>
          <p className="text-muted-foreground">
            View and search through your call history
          </p>
        </div>
        {!isSelectionMode ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSelectionMode(true)}
            disabled={calls.length === 0}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            Select
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedCalls.size} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedCalls.size === calls.length ? "Deselect All" : "Select All"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelected}
              disabled={selectedCalls.size === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelSelection}
            >
              <XSquare className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : calls.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {calls.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                onClick={() => handleCallClick(call)}
                isSelectable={isSelectionMode}
                isSelected={selectedCalls.has(call.id)}
                onSelect={handleSelectCall}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
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
          <p className="text-muted-foreground">
            {searchQuery || sentimentFilter !== "all" || dateRange
              ? "No calls found matching your criteria"
              : "No calls recorded yet. Calls will appear here once received via webhook."}
          </p>
        </div>
      )}

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
