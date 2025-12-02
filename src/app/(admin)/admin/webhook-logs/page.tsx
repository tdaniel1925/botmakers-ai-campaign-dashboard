"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Phone,
  FileText,
  Music,
  Timer,
  Hash,
  RefreshCw,
  Activity,
  Webhook,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

interface CampaignStats {
  campaignId: string;
  campaignName: string;
  clientName: string;
  webhookToken: string;
  totalLogs: number;
  successCount: number;
  failedCount: number;
  pingCount: number;
  callsWithTranscript: number;
  lastActivity: string | null;
  logs: WebhookLog[];
}

// Helper to detect fields from payload (mirrors webhook logic)
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
    "call_transcript", "conversation", "dialog", "artifact.transcript",
    "recording_transcript", "call_recording_transcript"
  ];

  const audioUrlKeys = [
    "recording_url", "recordingUrl", "audio_url", "audioUrl",
    "audio", "recording", "media_url", "mediaUrl",
    "stereo_recording_url", "stereoRecordingUrl",
    "artifact.recordingUrl", "call_recording_url", "recording_link"
  ];

  const phoneKeys = [
    "from", "phone", "caller", "phone_number", "phoneNumber",
    "caller_phone", "callerPhone", "customer_phone", "customerPhone",
    "from_number", "fromNumber", "caller_id", "callerId",
    "customer.number", "contact_phone", "lead_phone"
  ];

  const durationKeys = [
    "duration", "call_duration", "callDuration", "length",
    "duration_seconds", "durationSeconds", "duration_ms", "durationMs",
    "talk_time", "talkTime", "call_length", "callLength",
    "artifact.duration", "call_duration_seconds", "total_duration"
  ];

  const callIdKeys = [
    "id", "call_id", "callId", "external_id", "externalId",
    "recording_id", "recordingId", "uuid", "call_uuid", "callUuid",
    "call_reference", "unique_id"
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

function StatusIcon({ status, isPing }: { status: string; isPing: boolean }) {
  if (isPing) {
    return <Activity className="h-4 w-4 text-blue-500" />;
  }
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "processing":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-500" />;
  }
}

function DetectedFieldBadge({
  detected,
  label,
  icon: Icon
}: {
  detected: boolean;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
      detected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
    }`}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      {detected ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
    </div>
  );
}

function PayloadViewer({ payload, analysis }: {
  payload: Record<string, unknown>;
  analysis: ReturnType<typeof analyzePayload>;
}) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="space-y-3">
      {/* Detected Fields Summary */}
      <div className="flex flex-wrap gap-2">
        <DetectedFieldBadge detected={analysis.hasTranscript} label="Transcript" icon={FileText} />
        <DetectedFieldBadge detected={analysis.hasPhone} label="Phone" icon={Phone} />
        <DetectedFieldBadge detected={analysis.hasAudioUrl} label="Audio" icon={Music} />
        <DetectedFieldBadge detected={analysis.hasDuration} label="Duration" icon={Timer} />
        <DetectedFieldBadge detected={analysis.hasCallId} label="Call ID" icon={Hash} />
      </div>

      {/* Extracted Values */}
      {(analysis.hasTranscript || analysis.hasPhone || analysis.hasDuration || analysis.hasCallId) && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
          <h4 className="font-medium text-muted-foreground">Extracted Values:</h4>
          <div className="grid gap-2">
            {analysis.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-mono">{analysis.phone}</span>
              </div>
            )}
            {analysis.duration && (
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-mono">{analysis.duration}s</span>
              </div>
            )}
            {analysis.callId && (
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Call ID:</span>
                <span className="font-mono text-xs">{String(analysis.callId).slice(0, 30)}...</span>
              </div>
            )}
            {analysis.hasTranscript && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Transcript:</span>
                </div>
                <div className="ml-6 p-2 bg-background rounded border text-xs max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                  {String(analysis.transcript).slice(0, 500)}
                  {String(analysis.transcript).length > 500 && "..."}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw Payload Toggle */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs"
        >
          {showRaw ? "Hide" : "Show"} Raw Payload
        </Button>
        {showRaw && (
          <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-64">
            {JSON.stringify(payload, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function LogRow({ log }: { log: WebhookLog }) {
  const [isOpen, setIsOpen] = useState(false);
  const analysis = analyzePayload(log.payload);
  const isPing = log.error_message === "Ping received (no transcript)";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="hover:bg-muted/50">
        <TableCell className="w-8">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="font-mono text-xs">
          {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
          <div className="text-muted-foreground text-[10px]">
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <StatusIcon status={log.status} isPing={isPing} />
            {isPing ? (
              <Badge variant="secondary" className="text-xs">Ping</Badge>
            ) : log.status === "success" ? (
              <Badge variant="success" className="text-xs">Call Received</Badge>
            ) : log.status === "processing" ? (
              <Badge variant="secondary" className="text-xs">Processing</Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">Failed</Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            {analysis.hasTranscript && (
              <span title="Has Transcript">
                <FileText className="h-4 w-4 text-green-500" />
              </span>
            )}
            {analysis.hasPhone && (
              <span title="Has Phone">
                <Phone className="h-4 w-4 text-green-500" />
              </span>
            )}
            {analysis.hasAudioUrl && (
              <span title="Has Audio">
                <Music className="h-4 w-4 text-green-500" />
              </span>
            )}
            {analysis.hasDuration && (
              <span title="Has Duration">
                <Timer className="h-4 w-4 text-green-500" />
              </span>
            )}
            {!analysis.hasTranscript && !analysis.hasPhone && !analysis.hasAudioUrl && !analysis.hasDuration && (
              <span className="text-muted-foreground text-xs">No data detected</span>
            )}
          </div>
        </TableCell>
        <TableCell className="max-w-xs">
          {log.error_message && !isPing ? (
            <span className="text-red-600 text-xs truncate block">{log.error_message}</span>
          ) : analysis.phone ? (
            <span className="font-mono text-xs">{analysis.phone}</span>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="p-4">
            <PayloadViewer payload={log.payload} analysis={analysis} />
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CampaignSection({ stats }: { stats: CampaignStats }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    {stats.campaignName}
                  </CardTitle>
                  <CardDescription>
                    {stats.clientName} &bull; {stats.totalLogs} total webhooks
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Stats Summary */}
                <div className="flex gap-2">
                  <Badge variant="success" className="text-xs">
                    {stats.callsWithTranscript} calls
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {stats.pingCount} pings
                  </Badge>
                  {stats.failedCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {stats.failedCount} failed
                    </Badge>
                  )}
                </div>
                {stats.lastActivity && (
                  <span className="text-xs text-muted-foreground">
                    Last: {formatDistanceToNow(new Date(stats.lastActivity), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {/* Webhook URL Info */}
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Webhook URL:</div>
              <code className="text-xs bg-background px-2 py-1 rounded border block overflow-x-auto">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/{stats.webhookToken}
              </code>
            </div>

            {/* Logs Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="w-32">Time</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.logs.length > 0 ? (
                    stats.logs.map((log) => (
                      <LogRow key={log.id} log={log} />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No webhook logs for this campaign
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function WebhookLogsPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [campaignStats, setCampaignStats] = useState<CampaignStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "calls" | "pings" | "failed">("all");
  const [view, setView] = useState<"by-campaign" | "timeline">("by-campaign");
  const supabase = createClient();

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
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
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Error fetching logs:", error);
      setIsLoading(false);
      return;
    }

    const typedLogs = (data || []) as WebhookLog[];
    setLogs(typedLogs);

    // Group by campaign
    const campaignMap = new Map<string, CampaignStats>();

    for (const log of typedLogs) {
      const campaignId = log.campaign_id;
      const isPing = log.error_message === "Ping received (no transcript)";
      const analysis = analyzePayload(log.payload);

      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, {
          campaignId,
          campaignName: log.campaigns?.name || "Unknown Campaign",
          clientName: log.campaigns?.clients?.name || "Unknown Client",
          webhookToken: log.campaigns?.webhook_token || "",
          totalLogs: 0,
          successCount: 0,
          failedCount: 0,
          pingCount: 0,
          callsWithTranscript: 0,
          lastActivity: null,
          logs: [],
        });
      }

      const stats = campaignMap.get(campaignId)!;
      stats.totalLogs++;
      stats.logs.push(log);

      if (!stats.lastActivity || new Date(log.created_at) > new Date(stats.lastActivity)) {
        stats.lastActivity = log.created_at;
      }

      if (log.status === "success") {
        stats.successCount++;
        if (isPing) {
          stats.pingCount++;
        } else if (analysis.hasTranscript) {
          stats.callsWithTranscript++;
        }
      } else if (log.status === "failed") {
        stats.failedCount++;
      }
    }

    // Sort campaigns by last activity
    const sortedStats = Array.from(campaignMap.values()).sort((a, b) => {
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    setCampaignStats(sortedStats);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filter logs based on selection
  const getFilteredLogs = (logsToFilter: WebhookLog[]) => {
    switch (filter) {
      case "calls":
        return logsToFilter.filter(log => {
          const isPing = log.error_message === "Ping received (no transcript)";
          return log.status === "success" && !isPing;
        });
      case "pings":
        return logsToFilter.filter(log => log.error_message === "Ping received (no transcript)");
      case "failed":
        return logsToFilter.filter(log => log.status === "failed");
      default:
        return logsToFilter;
    }
  };

  // Calculate overall stats
  const overallStats = {
    total: logs.length,
    calls: logs.filter(l => l.status === "success" && l.error_message !== "Ping received (no transcript)").length,
    pings: logs.filter(l => l.error_message === "Ping received (no transcript)").length,
    failed: logs.filter(l => l.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhook Logs</h1>
          <p className="text-muted-foreground">
            Monitor incoming webhooks and diagnose integration issues
          </p>
        </div>
        <Button onClick={fetchLogs} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Webhooks</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.total}</div>
            <p className="text-xs text-muted-foreground">Last 500 entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calls Received</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overallStats.calls}</div>
            <p className="text-xs text-muted-foreground">With transcript data</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ping Tests</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{overallStats.pings}</div>
            <p className="text-xs text-muted-foreground">Connection tests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overallStats.failed}</div>
            <p className="text-xs text-muted-foreground">Errors to investigate</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as "by-campaign" | "timeline")}>
          <TabsList>
            <TabsTrigger value="by-campaign">By Campaign</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter logs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Webhooks</SelectItem>
            <SelectItem value="calls">Calls Only</SelectItem>
            <SelectItem value="pings">Pings Only</SelectItem>
            <SelectItem value="failed">Failed Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      {view === "by-campaign" ? (
        <div>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading webhook logs...
            </div>
          ) : campaignStats.length > 0 ? (
            campaignStats.map((stats) => {
              const filteredStats = {
                ...stats,
                logs: getFilteredLogs(stats.logs),
              };
              // Hide campaigns with no logs after filtering (unless filter is "all")
              if (filter !== "all" && filteredStats.logs.length === 0) return null;
              return <CampaignSection key={stats.campaignId} stats={filteredStats} />;
            })
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No webhook logs found. Webhooks will appear here once your voice AI platform sends data.
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="w-32">Time</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : getFilteredLogs(logs).length > 0 ? (
                    getFilteredLogs(logs).map((log) => {
                      const analysis = analyzePayload(log.payload);
                      const isPing = log.error_message === "Ping received (no transcript)";
                      return (
                        <Collapsible key={log.id} asChild>
                          <>
                            <TableRow className="hover:bg-muted/50">
                              <TableCell className="w-8">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </CollapsibleTrigger>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{log.campaigns?.name || "Unknown"}</div>
                                <div className="text-xs text-muted-foreground">
                                  {log.campaigns?.clients?.name || "Unknown Client"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <StatusIcon status={log.status} isPing={isPing} />
                                  {isPing ? (
                                    <Badge variant="secondary" className="text-xs">Ping</Badge>
                                  ) : log.status === "success" ? (
                                    <Badge variant="success" className="text-xs">Call</Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-xs">Failed</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {analysis.hasTranscript && <FileText className="h-4 w-4 text-green-500" />}
                                  {analysis.hasPhone && <Phone className="h-4 w-4 text-green-500" />}
                                  {analysis.hasAudioUrl && <Music className="h-4 w-4 text-green-500" />}
                                  {analysis.hasDuration && <Timer className="h-4 w-4 text-green-500" />}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs">
                                {log.error_message && !isPing ? (
                                  <span className="text-red-600 text-xs">{log.error_message}</span>
                                ) : analysis.phone ? (
                                  <span className="font-mono text-xs">{analysis.phone}</span>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={6} className="p-4">
                                  <PayloadViewer payload={log.payload} analysis={analysis} />
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No webhook logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
