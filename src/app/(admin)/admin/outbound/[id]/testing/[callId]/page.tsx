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
  Loader2,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  DollarSign,
  FileText,
  Braces,
  AudioLines,
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

export default function TestCallDetailsPage({
  params,
}: {
  params: Promise<{ id: string; callId: string }>;
}) {
  const { id, callId } = use(params);
  const [call, setCall] = useState<TestCallDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
      {/* Header with Back Link */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/outbound/${id}/testing`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Tests
          </Button>
        </Link>
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
