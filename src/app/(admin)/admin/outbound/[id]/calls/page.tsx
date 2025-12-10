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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  Phone,
  Users,
  BarChart3,
  Settings,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Play,
  X,
  FileText,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface CampaignContact {
  id: string;
  phone_number: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface OutboundCall {
  id: string;
  campaign_id: string;
  contact_id: string;
  vapi_call_id: string | null;
  status: string;
  outcome: string | null;
  duration_seconds: number;
  cost: string | null;
  transcript: string | null;
  summary: string | null;
  structured_data: Record<string, unknown> | null;
  recording_url: string | null;
  error_code: string | null;
  error_message: string | null;
  attempt_number: number;
  initiated_at: string;
  answered_at: string | null;
  ended_at: string | null;
  created_at: string;
  campaign_contacts: CampaignContact | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  client_id: string;
  clients: {
    name: string;
    company_name: string | null;
  } | null;
}

interface SmsLog {
  id: string;
  status: string;
  messageBody: string | null;
  phoneNumber: string | null;
  recipientName: string | null;
  ruleName: string | null;
  ruleCondition: string | null;
  aiReason: string | null;
  aiConfidence: number | null;
  twilioSid: string | null;
  twilioStatus: string | null;
  error: string | null;
  segmentCount: number | null;
  cost: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export default function OutboundCampaignCallsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [calls, setCalls] = useState<OutboundCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [selectedCall, setSelectedCall] = useState<OutboundCall | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [isLoadingSms, setIsLoadingSms] = useState(false);
  const { toast } = useToast();

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}`);
      if (!response.ok) throw new Error("Failed to fetch campaign");
      const data = await response.json();
      setCampaign(data);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      toast({
        title: "Error",
        description: "Failed to load campaign details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCalls = async (showLoading = true) => {
    if (showLoading) setIsLoadingCalls(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (outcomeFilter !== "all") params.append("outcome", outcomeFilter);

      const response = await fetch(
        `/api/admin/outbound-campaigns/${id}/calls?${params}`
      );
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
      setIsLoadingCalls(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  useEffect(() => {
    if (!isLoading) {
      fetchCalls();
    }
  }, [id, isLoading, page, statusFilter, outcomeFilter]);

  const fetchSmsLogs = async (callId: string) => {
    setIsLoadingSms(true);
    setSmsLogs([]);
    try {
      const response = await fetch(
        `/api/admin/outbound-campaigns/${id}/test-calls/${callId}/sms`
      );
      if (response.ok) {
        const data = await response.json();
        setSmsLogs(data.smsLogs || []);
      }
    } catch (error) {
      console.error("Error fetching SMS logs:", error);
    } finally {
      setIsLoadingSms(false);
    }
  };

  useEffect(() => {
    if (selectedCall) {
      fetchSmsLogs(selectedCall.id);
    } else {
      setSmsLogs([]);
    }
  }, [selectedCall?.id]);

  const getSmsStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge variant="default" className="bg-blue-500">
            <Send className="mr-1 h-3 w-3" />
            Sent
          </Badge>
        );
      case "delivered":
        return (
          <Badge variant="success">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Delivered
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "not_triggered":
        return (
          <Badge variant="outline">
            <AlertCircle className="mr-1 h-3 w-3" />
            Not Triggered
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "initiated":
        return <Badge variant="secondary">Initiated</Badge>;
      case "ringing":
        return <Badge variant="warning">Ringing</Badge>;
      case "in_progress":
        return <Badge variant="default">In Progress</Badge>;
      case "answered":
        return <Badge variant="success">Answered</Badge>;
      case "no_answer":
        return <Badge variant="secondary">No Answer</Badge>;
      case "busy":
        return <Badge variant="warning">Busy</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "voicemail":
        return <Badge variant="outline">Voicemail</Badge>;
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getOutcomeBadge = (outcome: string | null) => {
    switch (outcome) {
      case "positive":
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            Positive
          </Badge>
        );
      case "negative":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <ThumbsDown className="h-3 w-3" />
            Negative
          </Badge>
        );
      case "no_answer":
        return <Badge variant="secondary">No Answer</Badge>;
      case "voicemail":
        return <Badge variant="outline">Voicemail</Badge>;
      default:
        return outcome ? <Badge variant="secondary">{outcome}</Badge> : null;
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getContactDisplay = (call: OutboundCall) => {
    const contact = call.campaign_contacts;
    if (!contact) return "Unknown";
    const name = [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ");
    return name || contact.phone_number;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
        <Button asChild>
          <Link href="/admin/outbound">Back to Campaigns</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/outbound/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
          <p className="text-muted-foreground">
            {campaign.clients?.name}
            {campaign.clients?.company_name &&
              ` (${campaign.clients.company_name})`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value="calls">
        <TabsList>
          <TabsTrigger value="settings" asChild>
            <Link href={`/admin/outbound/${id}`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </TabsTrigger>
          <TabsTrigger value="contacts" asChild>
            <Link href={`/admin/outbound/${id}/contacts`}>
              <Users className="mr-2 h-4 w-4" />
              Contacts
            </Link>
          </TabsTrigger>
          <TabsTrigger value="calls">
            <Phone className="mr-2 h-4 w-4" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="analytics" asChild>
            <Link href={`/admin/outbound/${id}/analytics`}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
                    {total} total calls for this campaign
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="initiated">Initiated</SelectItem>
                      <SelectItem value="ringing">Ringing</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="answered">Answered</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="no_answer">No Answer</SelectItem>
                      <SelectItem value="busy">Busy</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="voicemail">Voicemail</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={outcomeFilter}
                    onValueChange={setOutcomeFilter}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outcomes</SelectItem>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                      <SelectItem value="no_answer">No Answer</SelectItem>
                      <SelectItem value="voicemail">Voicemail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCalls ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : calls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No calls found</p>
                  <p className="text-sm mt-1">
                    Calls will appear here when the campaign starts making calls
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Attempt</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calls.map((call) => (
                        <TableRow
                          key={call.id}
                          className={`cursor-pointer hover:bg-muted/50 ${
                            selectedCall?.id === call.id ? "bg-muted" : ""
                          }`}
                          onClick={() => setSelectedCall(call)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">
                                  {getContactDisplay(call)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {call.campaign_contacts?.phone_number}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(call.status)}</TableCell>
                          <TableCell>{getOutcomeBadge(call.outcome)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {formatDuration(call.duration_seconds)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">#{call.attempt_number}</Badge>
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
                {/* Contact Info */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Contact
                  </h4>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {getContactDisplay(selectedCall)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedCall.campaign_contacts?.phone_number}
                      </p>
                      {selectedCall.campaign_contacts?.email && (
                        <p className="text-sm text-muted-foreground">
                          {selectedCall.campaign_contacts.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

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
                      Cost
                    </h4>
                    <p className="font-medium">
                      ${parseFloat(selectedCall.cost || "0").toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Attempt
                    </h4>
                    <p className="font-medium">#{selectedCall.attempt_number}</p>
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

                {/* Error Info */}
                {selectedCall.error_message && (
                  <div>
                    <h4 className="text-sm font-medium text-destructive mb-1">
                      Error
                    </h4>
                    <p className="text-sm text-destructive">
                      {selectedCall.error_code && `[${selectedCall.error_code}] `}
                      {selectedCall.error_message}
                    </p>
                  </div>
                )}

                {/* Recording */}
                {selectedCall.recording_url && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Recording
                    </h4>
                    <audio
                      controls
                      src={selectedCall.recording_url}
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

                {/* Structured Data */}
                {selectedCall.structured_data &&
                  Object.keys(selectedCall.structured_data).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        Extracted Data
                      </h4>
                      <div className="bg-muted p-2 rounded text-sm space-y-1">
                        {Object.entries(selectedCall.structured_data).map(
                          ([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-muted-foreground">{key}:</span>
                              <span className="font-medium">
                                {typeof value === "boolean"
                                  ? value
                                    ? "Yes"
                                    : "No"
                                  : String(value)}
                              </span>
                            </div>
                          )
                        )}
                      </div>
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

                {/* SMS Follow-up */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    SMS Follow-up
                  </h4>
                  {isLoadingSms ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : smsLogs.length === 0 ? (
                    <div className="text-center py-3 text-muted-foreground text-sm bg-muted/50 rounded">
                      No SMS triggered for this call
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {smsLogs.map((sms) => (
                        <div
                          key={sms.id}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {sms.ruleName || "SMS"}
                            </span>
                            {getSmsStatusBadge(sms.status)}
                          </div>

                          {/* AI Decision */}
                          {sms.aiReason && (
                            <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-blue-700 dark:text-blue-300">
                                  AI Decision
                                </span>
                                {sms.aiConfidence !== null && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400">
                                    {Math.round(sms.aiConfidence * 100)}% confident
                                  </span>
                                )}
                              </div>
                              <p className="text-blue-800 dark:text-blue-200">
                                {sms.aiReason}
                              </p>
                            </div>
                          )}

                          {/* Message Preview */}
                          {sms.messageBody && (
                            <div className="bg-muted p-2 rounded text-sm">
                              <span className="text-muted-foreground text-xs">
                                Message:
                              </span>
                              <p className="mt-1">{sms.messageBody}</p>
                            </div>
                          )}

                          {/* Error */}
                          {sms.error && (
                            <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded text-sm text-red-600 dark:text-red-400">
                              {sms.error}
                            </div>
                          )}

                          {/* Technical Details */}
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {sms.phoneNumber && (
                              <span>To: {sms.phoneNumber}</span>
                            )}
                            {sms.sentAt && (
                              <span>
                                Sent: {format(new Date(sms.sentAt), "h:mm a")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
