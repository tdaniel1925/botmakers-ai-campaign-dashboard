"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { clientFetch } from "@/hooks/use-client-fetch";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckSquare,
  XSquare,
  Phone,
  Clock,
  PhoneIncoming,
  PhoneOutgoing,
  Megaphone,
  RefreshCw,
  X,
  FileText,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface UnifiedCall {
  id: string;
  campaign_type: "legacy" | "inbound" | "outbound";
  campaign_id: string;
  campaign_name: string;
  caller_phone: string | null;
  status: string;
  outcome: string | null;
  sentiment: string | null;
  duration_seconds: number;
  transcript: string | null;
  audio_url: string | null;
  summary: string | null;
  created_at: string;
  outcome_tag?: {
    tag_name: string;
    tag_color: string;
  } | null;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<UnifiedCall[]>([]);
  const [selectedCall, setSelectedCall] = useState<UnifiedCall | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [campaignTypeFilter, setCampaignTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const fetchCallsRef = useRef<(showLoading?: boolean) => Promise<void>>();

  const fetchCalls = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });
      if (campaignTypeFilter !== "all")
        params.append("campaign_type", campaignTypeFilter);
      if (sentimentFilter !== "all")
        params.append("sentiment", sentimentFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await clientFetch(`/api/client/calls?${params}`);
      if (!response.ok) throw new Error("Failed to fetch calls");
      const data = await response.json();
      setCalls(data.calls);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching calls:", error);
      if (showLoading) {
        toast({
          title: "Error",
          description: "Failed to load calls",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  fetchCallsRef.current = fetchCalls;

  useEffect(() => {
    fetchCalls();
  }, [page, sentimentFilter, campaignTypeFilter, searchQuery]);

  // Real-time subscriptions for instant updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("client-calls-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        () => fetchCallsRef.current?.(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbound_campaign_calls" },
        () => fetchCallsRef.current?.(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_calls" },
        () => fetchCallsRef.current?.(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getCampaignTypeBadge = (type: string) => {
    switch (type) {
      case "inbound":
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <PhoneIncoming className="h-3 w-3" />
            Inbound
          </Badge>
        );
      case "outbound":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <PhoneOutgoing className="h-3 w-3" />
            Outbound
          </Badge>
        );
      case "legacy":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Megaphone className="h-3 w-3" />
            Legacy
          </Badge>
        );
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    const normalized = status?.toLowerCase() || "unknown";
    switch (normalized) {
      case "completed":
      case "answered":
        return <Badge variant="success">Completed</Badge>;
      case "in_progress":
      case "processing":
        return <Badge variant="default">Processing</Badge>;
      case "failed":
      case "error":
        return <Badge variant="destructive">Failed</Badge>;
      case "no_answer":
        return <Badge variant="secondary">No Answer</Badge>;
      case "pending":
      case "initiated":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    const normalized = sentiment.toLowerCase();
    switch (normalized) {
      case "positive":
        return <Badge variant="success">Positive</Badge>;
      case "negative":
        return <Badge variant="destructive">Negative</Badge>;
      case "neutral":
        return <Badge variant="secondary">Neutral</Badge>;
      default:
        return <Badge variant="outline">{sentiment}</Badge>;
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getCampaignLink = (call: UnifiedCall) => {
    switch (call.campaign_type) {
      case "outbound":
        return `/dashboard/outbound/${call.campaign_id}`;
      case "legacy":
      default:
        return `/dashboard/campaigns/${call.campaign_id}`;
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
      setSelectedCalls(new Set(calls.map((c) => `${c.campaign_type}-${c.id}`)));
    }
  };

  const handleExportSelected = () => {
    const selectedData = calls.filter((c) =>
      selectedCalls.has(`${c.campaign_type}-${c.id}`)
    );
    const csvContent = [
      [
        "Date",
        "Type",
        "Campaign",
        "Phone",
        "Duration",
        "Status",
        "Sentiment",
        "Summary",
      ].join(","),
      ...selectedData.map((call) => {
        return [
          call.created_at
            ? new Date(call.created_at).toISOString()
            : "",
          call.campaign_type,
          `"${call.campaign_name.replace(/"/g, '""')}"`,
          call.caller_phone || "",
          call.duration_seconds || "",
          call.status,
          call.sentiment || "",
          `"${(call.summary || "").replace(/"/g, '""')}"`,
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calls</h1>
          <p className="text-muted-foreground">
            View and search through your call history across all campaigns
          </p>
        </div>
        <div className="flex gap-2">
          {!isSelectionMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchCalls()}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSelectionMode(true)}
                disabled={calls.length === 0}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Select
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground self-center">
                {selectedCalls.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedCalls.size === calls.length
                  ? "Deselect All"
                  : "Select All"}
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
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Calls List */}
        <div className={`flex-1 min-w-0 ${selectedCall ? "max-w-[calc(100%-400px)]" : ""}`}>
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Call History</CardTitle>
                  <CardDescription>
                    {total} total calls across all campaigns
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="pl-10 w-[150px]"
                    />
                  </div>
                  <Select
                    value={campaignTypeFilter}
                    onValueChange={(value) => {
                      setCampaignTypeFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                      <SelectItem value="legacy">Legacy</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={sentimentFilter}
                    onValueChange={(value) => {
                      setSentimentFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="All..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : calls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No calls found</p>
                  <p className="text-sm mt-1">
                    {searchQuery || sentimentFilter !== "all"
                      ? "No calls match your criteria"
                      : "Calls will appear here once received"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Card-based list view when sidebar is open */}
                  {selectedCall ? (
                    <div className="space-y-2">
                      {calls.map((call) => {
                        const callKey = `${call.campaign_type}-${call.id}`;
                        const isSelected = selectedCall?.id === call.id && selectedCall?.campaign_type === call.campaign_type;
                        return (
                          <div
                            key={callKey}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-muted/50 border-transparent bg-muted/30"
                            }`}
                            onClick={() => {
                              if (isSelectionMode) {
                                handleSelectCall(callKey, !selectedCalls.has(callKey));
                              } else {
                                setSelectedCall(call);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {isSelectionMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedCalls.has(callKey)}
                                    onChange={(e) => handleSelectCall(callKey, e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-4 w-4 flex-shrink-0"
                                  />
                                )}
                                {getCampaignTypeBadge(call.campaign_type)}
                                <span className="font-medium truncate">{call.campaign_name}</span>
                              </div>
                              {getStatusBadge(call.status)}
                            </div>
                            <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-3">
                                {call.sentiment && getSentimentBadge(call.sentiment)}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(call.duration_seconds)}
                                </span>
                              </div>
                              <span>{format(new Date(call.created_at), "MMM d, h:mm a")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Full table view when sidebar is closed */
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {isSelectionMode && <TableHead className="w-[40px]" />}
                            <TableHead>Type</TableHead>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sentiment</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {calls.map((call) => {
                            const callKey = `${call.campaign_type}-${call.id}`;
                            return (
                              <TableRow
                                key={callKey}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => {
                                  if (isSelectionMode) {
                                    handleSelectCall(
                                      callKey,
                                      !selectedCalls.has(callKey)
                                    );
                                  } else {
                                    setSelectedCall(call);
                                  }
                                }}
                              >
                                {isSelectionMode && (
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      checked={selectedCalls.has(callKey)}
                                      onChange={(e) =>
                                        handleSelectCall(callKey, e.target.checked)
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-4 w-4"
                                    />
                                  </TableCell>
                                )}
                                <TableCell>
                                  {getCampaignTypeBadge(call.campaign_type)}
                                </TableCell>
                                <TableCell>
                                  <Link
                                    href={getCampaignLink(call)}
                                    className="font-medium hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {call.campaign_name}
                                  </Link>
                                </TableCell>
                                <TableCell>
                                  <code className="text-sm">
                                    {call.caller_phone || "—"}
                                  </code>
                                </TableCell>
                                <TableCell>{getStatusBadge(call.status)}</TableCell>
                                <TableCell>
                                  {getSentimentBadge(call.sentiment) || "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    {formatDuration(call.duration_seconds)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    {format(
                                      new Date(call.created_at),
                                      "MMM d, h:mm a"
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(call.created_at), {
                                      addSuffix: true,
                                    })}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(page - 1)}
                          disabled={page === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(page + 1)}
                          disabled={page >= totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Call Detail Panel */}
        {selectedCall && (
          <div className="w-[380px] flex-shrink-0">
            <Card className="sticky top-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Call Details</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedCall(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Campaign Info */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Campaign
                  </h4>
                  <div className="space-y-1">
                    {getCampaignTypeBadge(selectedCall.campaign_type)}
                    <Link
                      href={getCampaignLink(selectedCall)}
                      className="block font-medium hover:underline mt-1"
                    >
                      {selectedCall.campaign_name}
                    </Link>
                  </div>
                </div>

                {/* Phone */}
                {selectedCall.caller_phone && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Phone
                    </h4>
                    <code className="text-sm">{selectedCall.caller_phone}</code>
                  </div>
                )}

                {/* Status & Sentiment */}
                <div className="flex gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Status
                    </h4>
                    {getStatusBadge(selectedCall.status)}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Sentiment
                    </h4>
                    {getSentimentBadge(selectedCall.sentiment) || (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                {/* Outcome Tag */}
                {selectedCall.outcome_tag && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Outcome
                    </h4>
                    <Badge
                      style={{
                        backgroundColor: selectedCall.outcome_tag.tag_color,
                        color: "#fff",
                      }}
                    >
                      {selectedCall.outcome_tag.tag_name}
                    </Badge>
                  </div>
                )}

                {/* Call Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Duration
                    </h4>
                    <p className="font-medium">
                      {formatDuration(selectedCall.duration_seconds)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Time
                    </h4>
                    <p className="font-medium text-sm">
                      {format(
                        new Date(selectedCall.created_at),
                        "MMM d, h:mm a"
                      )}
                    </p>
                  </div>
                </div>

                {/* Audio */}
                {selectedCall.audio_url && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Recording
                    </h4>
                    <audio
                      controls
                      src={selectedCall.audio_url}
                      className="w-full"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}

                {/* Summary */}
                {selectedCall.summary && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      AI Summary
                    </h4>
                    <p className="text-sm bg-muted p-2 rounded">
                      {selectedCall.summary}
                    </p>
                  </div>
                )}

                {/* Transcript */}
                {selectedCall.transcript && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      Transcript
                    </h4>
                    <div className="bg-muted p-3 rounded max-h-64 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap font-sans">
                        {selectedCall.transcript}
                      </pre>
                    </div>
                  </div>
                )}

                {/* View Campaign Link */}
                <div className="pt-2">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={getCampaignLink(selectedCall)}>
                      View Campaign Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
