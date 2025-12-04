"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  FileText,
  Music,
  Timer,
  Hash,
  RefreshCw,
  Activity,
  Webhook,
  Play,
  Pause,
  Download,
  Search,
  Eye,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Zap,
  Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WebhookLog {
  id: string;
  campaign_id: string;
  payload: Record<string, unknown>;
  status: string;
  error_message: string | null;
  created_at: string;
  campaigns: {
    name: string;
    webhook_token: string;
    clients: {
      name: string;
    } | null;
  } | null;
}

// Helper to detect fields from payload
function analyzePayload(payload: Record<string, unknown>) {
  const findValue = (obj: unknown, keys: string[]): unknown => {
    if (!obj || typeof obj !== "object") return undefined;
    const record = obj as Record<string, unknown>;

    for (const key of keys) {
      if (key in record && record[key] !== undefined && record[key] !== null && record[key] !== "") {
        return record[key];
      }
    }

    for (const key of keys) {
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
        if (current !== undefined && current !== null && current !== "") {
          return current;
        }
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const found = findValue(value, keys);
        if (found !== undefined) return found;
      }
    }

    return undefined;
  };

  const transcriptKeys = [
    "formatted_transcript", "transcript", "transcription", "text", "content", "message",
    "call_transcript", "conversation", "dialog", "artifact.transcript"
  ];

  const audioUrlKeys = [
    "recording_url", "recordingUrl", "audio_url", "audioUrl",
    "audio", "recording", "media_url", "mediaUrl",
    "stereo_recording_url", "stereoRecordingUrl",
    "artifact.recordingUrl", "call_recording_url"
  ];

  const phoneKeys = [
    "from", "phone", "caller", "phone_number", "phoneNumber",
    "caller_phone", "callerPhone", "customer_phone", "customerPhone",
    "customer.number", "contact_phone", "lead_phone", "to"
  ];

  const durationKeys = [
    "duration", "call_duration", "callDuration", "length",
    "duration_seconds", "durationSeconds",
    "call_length", "callLength", "artifact.duration", "call_duration_seconds"
  ];

  const callIdKeys = [
    "id", "call_id", "callId", "external_id", "externalId",
    "recording_id", "recordingId", "uuid", "call_uuid"
  ];

  let transcript = findValue(payload, ["formatted_transcript"]);
  if (!transcript) {
    transcript = findValue(payload, transcriptKeys);
  }
  if (Array.isArray(transcript)) {
    transcript = "[Array of messages]";
  }

  return {
    hasTranscript: !!transcript,
    transcript: transcript as string | undefined,
    hasAudioUrl: !!findValue(payload, audioUrlKeys),
    audioUrl: findValue(payload, audioUrlKeys) as string | undefined,
    hasPhone: !!findValue(payload, phoneKeys),
    phone: findValue(payload, phoneKeys) as string | undefined,
    hasDuration: !!findValue(payload, durationKeys),
    duration: findValue(payload, durationKeys) as number | string | undefined,
    hasCallId: !!findValue(payload, callIdKeys),
    callId: findValue(payload, callIdKeys) as string | undefined,
  };
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <audio ref={audioRef} src={src} preload="metadata" />
      <Button variant="outline" size="icon" onClick={togglePlay} className="h-10 w-10 shrink-0">
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 flex items-center gap-3">
        <span className="text-sm text-muted-foreground w-12">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <span className="text-sm text-muted-foreground w-12">{formatTime(duration)}</span>
      </div>
      <a href={src} download className="shrink-0">
        <Button variant="ghost" size="icon" className="h-10 w-10">
          <Download className="h-4 w-4" />
        </Button>
      </a>
    </div>
  );
}

function LogDetailModal({ log, open, onClose }: { log: WebhookLog | null; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!log) return null;

  const analysis = analyzePayload(log.payload);
  const isPing = log.error_message === "Ping received (no transcript)";

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(log.payload, null, 2));
    setCopied(true);
    toast({ title: "Copied", description: "Payload copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {isPing ? (
              <Badge variant="secondary">Ping Test</Badge>
            ) : log.status === "success" ? (
              <Badge variant="success">Call Received</Badge>
            ) : (
              <Badge variant="destructive">Failed</Badge>
            )}
            <span className="text-muted-foreground font-normal text-sm">
              {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm:ss a")}
            </span>
          </DialogTitle>
          <DialogDescription>
            {log.campaigns?.name} • {log.campaigns?.clients?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Detected Fields */}
          <div>
            <h4 className="text-sm font-medium mb-3">Detected Fields</h4>
            <div className="grid grid-cols-5 gap-2">
              <div className={`flex flex-col items-center p-3 rounded-lg border ${analysis.hasTranscript ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-muted/50"}`}>
                <FileText className={`h-5 w-5 mb-1 ${analysis.hasTranscript ? "text-green-600" : "text-muted-foreground"}`} />
                <span className="text-xs">Transcript</span>
              </div>
              <div className={`flex flex-col items-center p-3 rounded-lg border ${analysis.hasPhone ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-muted/50"}`}>
                <Phone className={`h-5 w-5 mb-1 ${analysis.hasPhone ? "text-green-600" : "text-muted-foreground"}`} />
                <span className="text-xs">Phone</span>
              </div>
              <div className={`flex flex-col items-center p-3 rounded-lg border ${analysis.hasAudioUrl ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-muted/50"}`}>
                <Music className={`h-5 w-5 mb-1 ${analysis.hasAudioUrl ? "text-green-600" : "text-muted-foreground"}`} />
                <span className="text-xs">Audio</span>
              </div>
              <div className={`flex flex-col items-center p-3 rounded-lg border ${analysis.hasDuration ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-muted/50"}`}>
                <Timer className={`h-5 w-5 mb-1 ${analysis.hasDuration ? "text-green-600" : "text-muted-foreground"}`} />
                <span className="text-xs">Duration</span>
              </div>
              <div className={`flex flex-col items-center p-3 rounded-lg border ${analysis.hasCallId ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-muted/50"}`}>
                <Hash className={`h-5 w-5 mb-1 ${analysis.hasCallId ? "text-green-600" : "text-muted-foreground"}`} />
                <span className="text-xs">Call ID</span>
              </div>
            </div>
          </div>

          {/* Extracted Data */}
          {(analysis.hasPhone || analysis.hasDuration || analysis.hasCallId) && (
            <div>
              <h4 className="text-sm font-medium mb-3">Extracted Data</h4>
              <div className="grid gap-2">
                {analysis.phone && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Phone:</span>
                    <span className="font-mono text-sm">{analysis.phone}</span>
                  </div>
                )}
                {analysis.duration && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Duration:</span>
                    <span className="font-mono text-sm">{analysis.duration}s</span>
                  </div>
                )}
                {analysis.callId && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Call ID:</span>
                    <span className="font-mono text-sm truncate">{String(analysis.callId)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audio Player */}
          {analysis.hasAudioUrl && analysis.audioUrl && (
            <div>
              <h4 className="text-sm font-medium mb-3">Call Recording</h4>
              <AudioPlayer src={analysis.audioUrl} />
            </div>
          )}

          {/* Transcript */}
          {analysis.hasTranscript && analysis.transcript && (
            <div>
              <h4 className="text-sm font-medium mb-3">Transcript</h4>
              <div className="p-4 bg-muted/50 rounded-lg max-h-48 overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap font-mono">{analysis.transcript}</pre>
              </div>
            </div>
          )}

          {/* Error Message */}
          {log.error_message && !isPing && (
            <div>
              <h4 className="text-sm font-medium mb-3 text-red-600">Error</h4>
              <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-400">{log.error_message}</p>
              </div>
            </div>
          )}

          {/* Raw Payload */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Raw Payload</h4>
              <Button variant="outline" size="sm" onClick={handleCopyPayload}>
                {copied ? <Check className="h-3 w-3 mr-2" /> : <Copy className="h-3 w-3 mr-2" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="p-4 bg-muted rounded-lg text-xs overflow-y-auto overflow-x-hidden max-h-64 font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ITEMS_PER_PAGE = 50;

export default function WebhookLogsPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "calls" | "pings" | "failed">("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [dateRange, setDateRange] = useState<"7" | "14" | "30" | "90" | "all">("7");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const supabase = createClient();

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);

    // Calculate date range filter
    let startDate: Date | null = null;
    if (dateRange !== "all") {
      const days = parseInt(dateRange);
      startDate = startOfDay(subDays(new Date(), days - 1));
    }

    // Calculate pagination offset
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    // Build query
    let query = supabase
      .from("webhook_logs")
      .select(`
        *,
        campaigns (
          name,
          webhook_token,
          clients (
            name
          )
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + ITEMS_PER_PAGE - 1);

    // Apply date filter
    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching logs:", error);
      setIsLoading(false);
      return;
    }

    const typedLogs = (data || []) as WebhookLog[];
    setLogs(typedLogs);
    setTotalCount(count || 0);

    // Fetch all campaigns for filter dropdown (separate query)
    const { data: allCampaigns } = await supabase
      .from("campaigns")
      .select("id, name")
      .order("name");

    if (allCampaigns) {
      setCampaigns(allCampaigns);
    }

    setIsLoading(false);
  }, [supabase, dateRange, currentPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const isPing = log.error_message === "Ping received (no transcript)";
    const analysis = analyzePayload(log.payload);

    // Status filter
    if (filter === "calls" && (isPing || log.status !== "success")) return false;
    if (filter === "pings" && !isPing) return false;
    if (filter === "failed" && log.status !== "failed") return false;

    // Campaign filter
    if (campaignFilter !== "all" && log.campaign_id !== campaignFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesCampaign = log.campaigns?.name?.toLowerCase().includes(query);
      const matchesClient = log.campaigns?.clients?.name?.toLowerCase().includes(query);
      const matchesPhone = analysis.phone?.toLowerCase().includes(query);
      if (!matchesCampaign && !matchesClient && !matchesPhone) return false;
    }

    return true;
  });

  // Stats
  const stats = {
    total: logs.length,
    calls: logs.filter(l => l.status === "success" && l.error_message !== "Ping received (no transcript)").length,
    pings: logs.filter(l => l.error_message === "Ping received (no transcript)").length,
    failed: logs.filter(l => l.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhook Logs</h1>
          <p className="text-muted-foreground">
            Monitor incoming webhooks across all campaigns
          </p>
        </div>
        <Button onClick={fetchLogs} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilter("all")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Webhooks</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Webhook className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilter("calls")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Calls Received</p>
                <p className="text-3xl font-bold text-green-600">{stats.calls}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-950/50 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilter("pings")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ping Tests</p>
                <p className="text-3xl font-bold text-blue-600">{stats.pings}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-950/50 rounded-full">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilter("failed")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by campaign, client, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="calls">Calls Only</SelectItem>
                <SelectItem value="pings">Pings Only</SelectItem>
                <SelectItem value="failed">Failed Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={(v) => {
              setDateRange(v as typeof dateRange);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Showing {filteredLogs.length} of {totalCount} webhook{totalCount !== 1 ? "s" : ""}
                {dateRange !== "all" && ` from the last ${dateRange} days`}
              </CardDescription>
            </div>
            {totalCount > ITEMS_PER_PAGE && (
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {Math.ceil(totalCount / ITEMS_PER_PAGE)}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Webhook className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No webhooks found</p>
              <p className="text-sm">Try adjusting your filters or wait for incoming data</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const analysis = analyzePayload(log.payload);
                const isPing = log.error_message === "Ping received (no transcript)";

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    {/* Status Icon */}
                    <div className={`p-2 rounded-full ${
                      isPing
                        ? "bg-blue-100 dark:bg-blue-950/50"
                        : log.status === "success"
                        ? "bg-green-100 dark:bg-green-950/50"
                        : "bg-red-100 dark:bg-red-950/50"
                    }`}>
                      {isPing ? (
                        <Zap className="h-5 w-5 text-blue-600" />
                      ) : log.status === "success" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{log.campaigns?.name || "Unknown Campaign"}</span>
                        <Badge variant={isPing ? "secondary" : log.status === "success" ? "success" : "destructive"} className="shrink-0">
                          {isPing ? "Ping" : log.status === "success" ? "Call" : "Failed"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{log.campaigns?.clients?.name || "Unknown Client"}</span>
                        {analysis.phone && (
                          <span className="font-mono">{analysis.phone}</span>
                        )}
                      </div>
                    </div>

                    {/* Detected Fields */}
                    <div className="hidden md:flex items-center gap-1">
                      {analysis.hasTranscript && (
                        <div className="p-1.5 bg-green-100 dark:bg-green-950/50 rounded" title="Has Transcript">
                          <FileText className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                      {analysis.hasPhone && (
                        <div className="p-1.5 bg-green-100 dark:bg-green-950/50 rounded" title="Has Phone">
                          <Phone className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                      {analysis.hasAudioUrl && (
                        <div className="p-1.5 bg-green-100 dark:bg-green-950/50 rounded" title="Has Audio">
                          <Music className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                      {analysis.hasDuration && (
                        <div className="p-1.5 bg-green-100 dark:bg-green-950/50 rounded" title="Has Duration">
                          <Timer className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                    </div>

                    {/* Time */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium">
                        {format(new Date(log.created_at), "MMM d, HH:mm")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalCount > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1 || isLoading}
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: Math.min(5, Math.ceil(totalCount / ITEMS_PER_PAGE)) }, (_, i) => {
                    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={isLoading}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / ITEMS_PER_PAGE), p + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / ITEMS_PER_PAGE) || isLoading}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(Math.ceil(totalCount / ITEMS_PER_PAGE))}
                  disabled={currentPage >= Math.ceil(totalCount / ITEMS_PER_PAGE) || isLoading}
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <LogDetailModal
        log={selectedLog}
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}
