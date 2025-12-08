"use client";

import { useState, useEffect, useRef } from "react";
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
  Loader2,
  Phone,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  PhoneIncoming,
  PhoneOutgoing,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface UnifiedCall {
  id: string;
  campaign_type: "legacy" | "inbound" | "outbound";
  campaign_id: string;
  campaign_name: string;
  client_name: string;
  caller_phone: string | null;
  status: string;
  outcome: string | null;
  duration_seconds: number;
  transcript: string | null;
  audio_url: string | null;
  created_at: string;
  summary?: string | null;
}

interface Client {
  id: string;
  name: string;
}

export default function AdminCallsPage() {
  const [calls, setCalls] = useState<UnifiedCall[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<UnifiedCall | null>(null);
  const [campaignTypeFilter, setCampaignTypeFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const { toast } = useToast();
  const fetchCallsRef = useRef<(showLoading?: boolean) => Promise<void>>();

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/admin/clients");
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchCalls = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });
      if (campaignTypeFilter !== "all")
        params.append("campaign_type", campaignTypeFilter);
      if (clientFilter !== "all") params.append("client_id", clientFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/admin/calls/unified?${params}`);
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
    fetchClients();
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [page, campaignTypeFilter, clientFilter, statusFilter]);

  // Real-time subscriptions for instant updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("admin-calls-list")
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
        return <Badge variant="default">In Progress</Badge>;
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

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return null;
    const normalized = outcome.toLowerCase();
    switch (normalized) {
      case "positive":
        return <Badge variant="success">Positive</Badge>;
      case "negative":
        return <Badge variant="destructive">Negative</Badge>;
      case "neutral":
        return <Badge variant="secondary">Neutral</Badge>;
      default:
        return <Badge variant="outline">{outcome}</Badge>;
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
      case "inbound":
        return `/admin/inbound/${call.campaign_id}`;
      case "outbound":
        return `/admin/outbound/${call.campaign_id}`;
      case "legacy":
        return `/admin/campaigns/${call.campaign_id}`;
      default:
        return "#";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Calls</h1>
          <p className="text-muted-foreground">
            View calls from all campaign types in one place
          </p>
        </div>
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
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calls List */}
        <div className={selectedCall ? "lg:col-span-2" : "lg:col-span-3"}>
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
                  <Select
                    value={campaignTypeFilter}
                    onValueChange={(value) => {
                      setCampaignTypeFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[130px]">
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
                    value={clientFilter}
                    onValueChange={(value) => {
                      setClientFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
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
                    Calls will appear here when campaigns start receiving or
                    making calls
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calls.map((call) => (
                        <TableRow
                          key={`${call.campaign_type}-${call.id}`}
                          className={`cursor-pointer hover:bg-muted/50 ${
                            selectedCall?.id === call.id &&
                            selectedCall?.campaign_type === call.campaign_type
                              ? "bg-muted"
                              : ""
                          }`}
                          onClick={() => setSelectedCall(call)}
                        >
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
                          <TableCell className="text-muted-foreground">
                            {call.client_name}
                          </TableCell>
                          <TableCell>
                            <code className="text-sm">
                              {call.caller_phone || "—"}
                            </code>
                          </TableCell>
                          <TableCell>{getStatusBadge(call.status)}</TableCell>
                          <TableCell>
                            {getOutcomeBadge(call.outcome) || "—"}
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
                      ))}
                    </TableBody>
                  </Table>

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
          <div className="lg:col-span-1">
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
                    <p className="text-sm text-muted-foreground">
                      {selectedCall.client_name}
                    </p>
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

                {/* Status & Outcome */}
                <div className="flex gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Status
                    </h4>
                    {getStatusBadge(selectedCall.status)}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Outcome
                    </h4>
                    {getOutcomeBadge(selectedCall.outcome) || (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

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
                      {format(new Date(selectedCall.created_at), "MMM d, h:mm a")}
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

                {/* View in Campaign Link */}
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
