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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  User,
  DollarSign,
  FileText,
  Braces,
  AudioLines,
  MessageSquare,
  Send,
  AlertCircle,
  Bot,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

interface TestCallDetails {
  id: string;
  campaign_id: string;
  phone_number: string;
  first_name: string | null;
  status: string;
  outcome: string | null;
  duration_seconds: number | null;
  cost: string | null;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  structured_data: Record<string, unknown> | null;
  vapi_call_id: string | null;
  vapi_ended_reason: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  initiated_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  campaign: {
    id: string;
    name: string;
    rate_per_minute: string | null;
    structured_data_schema: Array<{ name: string; type: string; description: string }> | null;
  } | null;
}

interface SmsLog {
  id: string;
  status: string;
  messageBody: string;
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

export default function TestCallDetailsPage({
  params,
}: {
  params: Promise<{ id: string; callId: string }>;
}) {
  const { id, callId } = use(params);
  const [call, setCall] = useState<TestCallDetails | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [navigation, setNavigation] = useState<{ prevId: string | null; nextId: string | null }>({ prevId: null, nextId: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isSmsLoading, setIsSmsLoading] = useState(false);
  const [refreshingSmsId, setRefreshingSmsId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSmsLogs = async () => {
    setIsSmsLoading(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/test-calls/${callId}/sms`);
      if (response.ok) {
        const data = await response.json();
        setSmsLogs(data.smsLogs || []);
      }
    } catch (error) {
      console.error("Error fetching SMS logs:", error);
    } finally {
      setIsSmsLoading(false);
    }
  };

  const refreshSmsStatus = async (smsId: string) => {
    setRefreshingSmsId(smsId);
    try {
      const response = await fetch(
        `/api/admin/outbound-campaigns/${id}/test-calls/${callId}/sms/${smsId}/refresh`,
        { method: "POST" }
      );

      if (response.ok) {
        const data = await response.json();
        // Update the SMS in the local state
        setSmsLogs(logs => logs.map(log => {
          if (log.id === smsId) {
            return {
              ...log,
              status: data.sms.status,
              twilioStatus: data.sms.twilioStatus,
              deliveredAt: data.sms.dateUpdated || log.deliveredAt,
            };
          }
          return log;
        }));
        toast({
          title: "Status Updated",
          description: `SMS status: ${data.sms.twilioStatus}`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to refresh status",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error refreshing SMS status:", error);
      toast({
        title: "Error",
        description: "Failed to refresh SMS status",
        variant: "destructive",
      });
    } finally {
      setRefreshingSmsId(null);
    }
  };

  const fetchCallDetails = async () => {
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/test-calls/${callId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Test call not found");
        }
        throw new Error("Failed to fetch test call details");
      }
      const data = await response.json();
      setCall(data.call);
      setNavigation(data.navigation || { prevId: null, nextId: null });
    } catch (error) {
      console.error("Error fetching call details:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load call details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCallDetails();
    fetchSmsLogs();
  }, [id, callId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "initiated":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Initiated</Badge>;
      case "ringing":
        return <Badge variant="warning"><Phone className="mr-1 h-3 w-3" /> Ringing</Badge>;
      case "answered":
        return <Badge variant="default"><Phone className="mr-1 h-3 w-3" /> In Progress</Badge>;
      case "completed":
        return <Badge variant="success"><CheckCircle className="mr-1 h-3 w-3" /> Completed</Badge>;
      case "no_answer":
        return <Badge variant="outline">No Answer</Badge>;
      case "busy":
        return <Badge variant="outline">Busy</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return null;
    switch (outcome) {
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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCost = (cost: string | null, durationSeconds: number | null) => {
    // Admin sees actual cost, not marked up
    if (cost) {
      return `$${parseFloat(cost).toFixed(4)}`;
    }
    return "$0.0000";
  };

  const getSmsStatusBadge = (status: string, twilioStatus?: string | null) => {
    // Use twilioStatus for more accurate display if available
    const displayStatus = twilioStatus || status;
    switch (displayStatus) {
      case "sent":
        return <Badge variant="default"><Send className="mr-1 h-3 w-3" /> Sent</Badge>;
      case "delivered":
        return <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Delivered</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
      case "queued":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Queued</Badge>;
      case "sending":
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Sending</Badge>;
      case "undelivered":
        return <Badge variant="warning"><AlertTriangle className="mr-1 h-3 w-3" /> Undelivered</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{displayStatus}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Test call not found</h2>
        <Button asChild>
          <Link href={`/admin/outbound/${id}/testing`}>Back to Testing</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Link and Navigation */}
      <div className="flex items-center justify-between">
        <Link href={`/admin/outbound/${id}/testing`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Tests
          </Button>
        </Link>
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            disabled={!navigation.prevId}
            asChild={!!navigation.prevId}
            className="rounded-r-none border-r-0"
          >
            {navigation.prevId ? (
              <Link href={`/admin/outbound/${id}/testing/${navigation.prevId}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span>
                <ChevronLeft className="h-4 w-4" />
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!navigation.nextId}
            asChild={!!navigation.nextId}
            className="rounded-l-none"
          >
            {navigation.nextId ? (
              <Link href={`/admin/outbound/${id}/testing/${navigation.nextId}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span>
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Call Details</h1>
        <p className="text-muted-foreground">
          {call.campaign?.name || "Campaign"} - {format(new Date(call.created_at), "MMMM d, yyyy 'at' h:mm a")}
        </p>
      </div>

      {/* Call Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Phone Number</span>
            </div>
            <p className="font-mono text-lg">{call.phone_number}</p>
            {call.first_name && (
              <p className="text-sm text-muted-foreground mt-1">
                <User className="inline h-3 w-3 mr-1" />
                {call.first_name}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Status</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(call.status)}
              {getOutcomeBadge(call.outcome)}
            </div>
            {call.vapi_ended_reason && (
              <p className="text-xs text-muted-foreground mt-2">
                Ended: {call.vapi_ended_reason}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Duration</span>
            </div>
            <p className="text-lg font-semibold">{formatDuration(call.duration_seconds)}</p>
            {call.answered_at && call.ended_at && (
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(call.answered_at), "h:mm:ss a")} - {format(new Date(call.ended_at), "h:mm:ss a")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Actual Cost</span>
            </div>
            <p className="text-lg font-semibold">{formatCost(call.cost, call.duration_seconds)}</p>
            {call.campaign?.rate_per_minute && (
              <p className="text-xs text-muted-foreground mt-1">
                Rate: ${parseFloat(call.campaign.rate_per_minute).toFixed(4)}/min
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recording */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AudioLines className="h-5 w-5" />
              Recording
            </CardTitle>
          </CardHeader>
          <CardContent>
            {call.recording_url ? (
              <audio controls className="w-full">
                <source src={call.recording_url} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No recording available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {call.summary ? (
              <p className="text-sm leading-relaxed">{call.summary}</p>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No summary available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Structured Data */}
      {call.structured_data && Object.keys(call.structured_data).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Braces className="h-5 w-5" />
              Collected Data
            </CardTitle>
            <CardDescription>
              Data extracted from the call based on campaign schema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(call.structured_data).map(([key, value]) => {
                // Find the schema definition for this field if available
                const schemaField = call.campaign?.structured_data_schema?.find(
                  (f) => f.name === key
                );

                return (
                  <div key={key} className="p-4 bg-muted rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground capitalize mb-1">
                      {key.replace(/_/g, " ")}
                    </div>
                    <div className="font-semibold">
                      {typeof value === "boolean" ? (
                        value ? (
                          <Badge variant="success">Yes</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )
                      ) : value === null || value === undefined ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        String(value)
                      )}
                    </div>
                    {schemaField?.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {schemaField.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SMS Follow-up Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Follow-up
          </CardTitle>
          <CardDescription>
            Intent-based SMS triggered by conversation analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSmsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : smsLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No SMS triggered for this call</p>
              <p className="text-sm mt-2">
                {call.status !== "completed"
                  ? "SMS will be evaluated after the call completes"
                  : "No SMS rules matched the conversation intent"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {smsLogs.map((sms) => (
                <div key={sms.id} className="border rounded-lg p-4 space-y-3">
                  {/* SMS Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getSmsStatusBadge(sms.status, sms.twilioStatus)}
                      {sms.ruleName && (
                        <Badge variant="outline">{sms.ruleName}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {sms.sentAt
                          ? format(new Date(sms.sentAt), "MMM d, h:mm a")
                          : format(new Date(sms.createdAt), "MMM d, h:mm a")}
                      </span>
                      {sms.twilioSid && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => refreshSmsStatus(sms.id)}
                          disabled={refreshingSmsId === sms.id}
                          title="Refresh delivery status from Twilio"
                        >
                          <RefreshCw className={`h-4 w-4 ${refreshingSmsId === sms.id ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Delivery Confirmation Banner */}
                  {sms.twilioStatus === "delivered" && (
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg p-3">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Delivered to {sms.phoneNumber}</p>
                        {sms.deliveredAt && (
                          <p className="text-xs opacity-75">
                            Confirmed at {format(new Date(sms.deliveredAt), "MMM d, h:mm:ss a")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Undelivered Warning */}
                  {sms.twilioStatus === "undelivered" && (
                    <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 rounded-lg p-3">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Message Not Delivered</p>
                        <p className="text-xs opacity-75">
                          The carrier could not deliver this message. The recipient&apos;s phone may be off or unreachable.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI Evaluation */}
                  {sms.aiReason && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Bot className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            AI Decision
                            {sms.aiConfidence && (
                              <span className="ml-2 text-xs">
                                ({Math.round(sms.aiConfidence * 100)}% confidence)
                              </span>
                            )}
                          </p>
                          <p className="text-sm">{sms.aiReason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rule Condition */}
                  {sms.ruleCondition && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Trigger condition: </span>
                      <span className="italic">&quot;{sms.ruleCondition}&quot;</span>
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="bg-background border rounded-lg p-3">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Message sent:</p>
                    <p className="text-sm whitespace-pre-wrap">{sms.messageBody}</p>
                  </div>

                  {/* Technical Details */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {sms.phoneNumber && (
                      <span>To: {sms.phoneNumber}</span>
                    )}
                    {sms.twilioSid && (
                      <span className="font-mono">SID: {sms.twilioSid}</span>
                    )}
                    {sms.segmentCount && (
                      <span>{sms.segmentCount} segment{sms.segmentCount > 1 ? "s" : ""}</span>
                    )}
                    {sms.cost && (
                      <span>Cost: ${parseFloat(sms.cost).toFixed(4)}</span>
                    )}
                  </div>

                  {/* Error Message */}
                  {sms.error && (
                    <div className="flex items-start gap-2 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{sms.error}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transcript
          </CardTitle>
          <CardDescription>
            Full conversation transcript from the call
          </CardDescription>
        </CardHeader>
        <CardContent>
          {call.transcript ? (
            <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                {call.transcript}
              </pre>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transcript available</p>
              {call.status !== "completed" && (
                <p className="text-sm mt-2">
                  Transcript will be available once the call is completed
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Details (if failed) */}
      {(call.error_code || call.error_message) && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Error Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {call.error_code && (
              <div className="mb-2">
                <span className="text-sm font-medium text-muted-foreground">Error Code: </span>
                <code className="text-sm bg-muted px-2 py-1 rounded">{call.error_code}</code>
              </div>
            )}
            {call.error_message && (
              <p className="text-sm text-destructive">{call.error_message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">Call ID</dt>
              <dd className="font-mono">{call.id}</dd>
            </div>
            {call.vapi_call_id && (
              <div>
                <dt className="font-medium text-muted-foreground">Provider Call ID</dt>
                <dd className="font-mono">{call.vapi_call_id}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-muted-foreground">Initiated At</dt>
              <dd>{format(new Date(call.initiated_at || call.created_at), "PPpp")}</dd>
            </div>
            {call.answered_at && (
              <div>
                <dt className="font-medium text-muted-foreground">Answered At</dt>
                <dd>{format(new Date(call.answered_at), "PPpp")}</dd>
              </div>
            )}
            {call.ended_at && (
              <div>
                <dt className="font-medium text-muted-foreground">Ended At</dt>
                <dd>{format(new Date(call.ended_at), "PPpp")}</dd>
              </div>
            )}
            {call.vapi_ended_reason && (
              <div>
                <dt className="font-medium text-muted-foreground">End Reason</dt>
                <dd>{call.vapi_ended_reason}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
