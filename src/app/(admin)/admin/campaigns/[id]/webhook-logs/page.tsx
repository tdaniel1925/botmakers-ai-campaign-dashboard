"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Zap,
  FileJson,
  Phone,
  FileText,
  Music,
  Timer,
  Hash,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  Filter,
  Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format, formatDistanceToNow } from "date-fns";

interface WebhookLog {
  id: string;
  campaign_id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  payload: Record<string, unknown>;
}

interface CampaignData {
  id: string;
  name: string;
  webhook_token: string;
}

// Field detection for payload analysis
function analyzePayload(payload: Record<string, unknown>) {
  const findValue = (obj: unknown, keys: string[]): unknown => {
    if (!obj || typeof obj !== "object") return undefined;
    const record = obj as Record<string, unknown>;
    for (const key of keys) {
      if (key in record && record[key]) return record[key];
      if (key.includes(".")) {
        const parts = key.split(".");
        let current: unknown = record;
        for (const part of parts) {
          if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[part];
          } else {
            current = undefined;
            break;
          }
        }
        if (current) return current;
      }
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const found = findValue(value, keys);
        if (found) return found;
      }
    }
    return undefined;
  };

  const transcriptKeys = ["formatted_transcript", "transcript", "transcription", "text", "artifact.transcript"];
  const audioUrlKeys = ["recording_url", "recordingUrl", "audio_url", "artifact.recordingUrl"];
  const phoneKeys = ["from", "phone", "caller", "contact_phone", "customer.number", "to"];
  const durationKeys = ["duration", "call_duration", "call_length", "artifact.duration", "call_duration_seconds"];
  const callIdKeys = ["id", "call_id", "callId", "uuid"];

  return {
    hasTranscript: !!findValue(payload, transcriptKeys),
    hasAudioUrl: !!findValue(payload, audioUrlKeys),
    hasPhone: !!findValue(payload, phoneKeys),
    hasDuration: !!findValue(payload, durationKeys),
    hasCallId: !!findValue(payload, callIdKeys),
  };
}

export default function WebhookLogsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [copied, setCopied] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCampaign = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/campaigns/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch campaign");
      const data = await response.json();
      setCampaign(data);
    } catch {
      toast({ title: "Error", description: "Failed to load campaign", variant: "destructive" });
      router.push("/admin/campaigns");
    }
  }, [params.id, router, toast]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("webhook_logs")
        .select("*", { count: "exact" })
        .eq("campaign_id", params.id)
        .order("created_at", { ascending: false });

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setLogs(data || []);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / pageSize));
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast({ title: "Error", description: "Failed to load webhook logs", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [params.id, page, statusFilter, supabase, toast]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleCopyPayload = (payload: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    toast({ title: "Copied!", description: "Payload copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `webhook-logs-${campaign?.name || params.id}-${format(new Date(), "yyyy-MM-dd")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported!", description: "Webhook logs exported to JSON file" });
  };

  const getLogTypeLabel = (log: WebhookLog) => {
    const analysis = analyzePayload(log.payload);
    const isPing = log.error_message === "Ping received (no transcript)";

    if (isPing) return { label: "Ping", variant: "secondary" as const };
    if (log.status === "success" && analysis.hasTranscript) return { label: "Call", variant: "success" as const };
    if (log.status === "success") return { label: "Event", variant: "default" as const };
    return { label: "Failed", variant: "destructive" as const };
  };

  // Filter logs by search query (client-side for now)
  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const payloadStr = JSON.stringify(log.payload).toLowerCase();
    return payloadStr.includes(searchLower) ||
           log.id.toLowerCase().includes(searchLower) ||
           (log.error_message && log.error_message.toLowerCase().includes(searchLower));
  });

  if (isLoading && !campaign) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/campaigns/${params.id}?tab=webhook`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Campaign
            </Link>
          </Button>
        </div>
        <Badge variant="secondary" className="text-sm">
          {campaign?.name}
        </Badge>
      </div>

      {/* Title and Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Webhook Logs</h1>
          <p className="text-muted-foreground">
            View all incoming webhook payloads for this campaign
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {totalCount} total webhooks
          </div>
          <Button variant="outline" size="sm" onClick={handleExportLogs} disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search in payloads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Webhooks</CardTitle>
          <CardDescription>
            Click on a webhook to view the full payload
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileJson className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No webhooks found</p>
              <p className="text-sm">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Webhooks will appear here when your AI platform sends call data"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const analysis = analyzePayload(log.payload);
                const typeInfo = getLogTypeLabel(log);
                const isPing = log.error_message === "Ping received (no transcript)";

                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Status Icon */}
                      <div className={`p-2 rounded-full ${
                        log.status === "success"
                          ? isPing
                            ? "bg-blue-100 dark:bg-blue-950"
                            : "bg-green-100 dark:bg-green-950"
                          : "bg-red-100 dark:bg-red-950"
                      }`}>
                        {log.status === "success" ? (
                          isPing ? (
                            <Zap className="h-4 w-4 text-blue-600" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={typeInfo.variant}>
                            {typeInfo.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {log.id.substring(0, 8)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(log.created_at.endsWith("Z") ? log.created_at : log.created_at + "Z"), "MMM d, h:mm a")}
                          </span>
                          <span>
                            {formatDistanceToNow(new Date(log.created_at.endsWith("Z") ? log.created_at : log.created_at + "Z"), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Detected Fields & Actions */}
                    <div className="flex items-center gap-4">
                      {/* Detected Fields Icons */}
                      <div className="flex items-center gap-1">
                        {analysis.hasTranscript && (
                          <div className="p-1 rounded bg-green-100 dark:bg-green-950" title="Transcript detected">
                            <FileText className="h-3 w-3 text-green-600" />
                          </div>
                        )}
                        {analysis.hasPhone && (
                          <div className="p-1 rounded bg-green-100 dark:bg-green-950" title="Phone detected">
                            <Phone className="h-3 w-3 text-green-600" />
                          </div>
                        )}
                        {analysis.hasAudioUrl && (
                          <div className="p-1 rounded bg-green-100 dark:bg-green-950" title="Recording URL detected">
                            <Music className="h-3 w-3 text-green-600" />
                          </div>
                        )}
                        {analysis.hasDuration && (
                          <div className="p-1 rounded bg-green-100 dark:bg-green-950" title="Duration detected">
                            <Timer className="h-3 w-3 text-green-600" />
                          </div>
                        )}
                        {analysis.hasCallId && (
                          <div className="p-1 rounded bg-green-100 dark:bg-green-950" title="Call ID detected">
                            <Hash className="h-3 w-3 text-green-600" />
                          </div>
                        )}
                      </div>

                      {/* View Button */}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payload Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <FileJson className="h-5 w-5" />
              Webhook Payload
            </DialogTitle>
            <DialogDescription>
              {selectedLog && (
                <span className="flex items-center gap-2">
                  <Badge variant={selectedLog.status === "success" ? "success" : "destructive"}>
                    {selectedLog.status}
                  </Badge>
                  <span>
                    {format(new Date(selectedLog.created_at.endsWith("Z") ? selectedLog.created_at : selectedLog.created_at + "Z"), "MMMM d, yyyy 'at' h:mm:ss a")}
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Error Message */}
              {selectedLog.error_message && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    <strong>Error:</strong> {selectedLog.error_message}
                  </p>
                </div>
              )}

              {/* Detected Fields Summary */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Detected Fields</h4>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const analysis = analyzePayload(selectedLog.payload);
                    return (
                      <>
                        <Badge variant={analysis.hasTranscript ? "success" : "outline"}>
                          <FileText className="h-3 w-3 mr-1" />
                          Transcript
                        </Badge>
                        <Badge variant={analysis.hasPhone ? "success" : "outline"}>
                          <Phone className="h-3 w-3 mr-1" />
                          Phone
                        </Badge>
                        <Badge variant={analysis.hasAudioUrl ? "success" : "outline"}>
                          <Music className="h-3 w-3 mr-1" />
                          Recording
                        </Badge>
                        <Badge variant={analysis.hasDuration ? "success" : "outline"}>
                          <Timer className="h-3 w-3 mr-1" />
                          Duration
                        </Badge>
                        <Badge variant={analysis.hasCallId ? "success" : "outline"}>
                          <Hash className="h-3 w-3 mr-1" />
                          Call ID
                        </Badge>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Payload JSON */}
              <div className="flex-1 overflow-auto">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Raw Payload</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyPayload(selectedLog.payload)}
                  >
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    Copy
                  </Button>
                </div>
                <pre className="p-4 rounded-lg bg-muted font-mono text-xs overflow-auto max-h-[400px]">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
