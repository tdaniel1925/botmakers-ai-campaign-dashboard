"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface CampaignData {
  id: string;
  name: string;
  webhook_token: string;
}

interface WebhookLog {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function WebhookConfigPage() {
  const params = useParams();
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const webhookUrl = campaign
    ? `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/webhooks/${campaign.webhook_token}`
    : "";

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/admin/campaigns/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch campaign");
      const data = await response.json();
      setCampaign(data);

      // Fetch recent webhook logs
      const logsResponse = await fetch(`/api/admin/campaigns/${params.id}/webhook-logs`);
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setLogs(logsData.slice(0, 10)); // Last 10 logs
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load campaign",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href={`/admin/campaigns/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhook</h1>
          <p className="text-muted-foreground">
            Connect your voice AI platform to receive call data
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Webhook URL Card */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook URL</CardTitle>
            <CardDescription>
              Copy this URL and paste it in your Vapi or AutoCalls.ai webhook settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <code className="flex-1 text-sm bg-muted p-3 rounded break-all font-mono">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyWebhook}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <h4 className="font-medium text-sm">How it works</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Copy the webhook URL above</li>
                <li>Paste it in your voice AI platform&apos;s webhook settings</li>
                <li>When calls complete, the platform sends data here</li>
                <li>We auto-detect the transcript, duration, phone, etc.</li>
                <li>AI analyzes the call for sentiment and outcomes</li>
              </ol>
            </div>

            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4">
              <h4 className="font-medium text-sm text-blue-700 dark:text-blue-400">
                Supported Platforms
              </h4>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                Vapi, AutoCalls.ai, and any platform that sends JSON with a transcript field
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Logs Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Webhook Calls</CardTitle>
                <CardDescription>
                  Last 10 webhook requests received
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={fetchData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No webhook calls received yet</p>
                <p className="text-xs mt-1">
                  Send a test call from your voice AI platform
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      {log.status === "success" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : log.status === "failed" ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                      <div>
                        <Badge
                          variant={
                            log.status === "success"
                              ? "default"
                              : log.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {log.status}
                        </Badge>
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-1">
                            {log.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Auto-Detection Info */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Detection</CardTitle>
          <CardDescription>
            We automatically detect these fields from your webhook payload
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="p-3 rounded-lg border">
              <h4 className="font-medium text-sm">Transcript</h4>
              <p className="text-xs text-muted-foreground mt-1">
                transcript, transcription, text, content
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <h4 className="font-medium text-sm">Audio URL</h4>
              <p className="text-xs text-muted-foreground mt-1">
                recording_url, audio_url, audio, recording
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <h4 className="font-medium text-sm">Phone Number</h4>
              <p className="text-xs text-muted-foreground mt-1">
                from, phone, caller, phone_number
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <h4 className="font-medium text-sm">Duration</h4>
              <p className="text-xs text-muted-foreground mt-1">
                duration, call_duration, length
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <h4 className="font-medium text-sm">Timestamp</h4>
              <p className="text-xs text-muted-foreground mt-1">
                timestamp, created_at, start_time
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <h4 className="font-medium text-sm">Call ID</h4>
              <p className="text-xs text-muted-foreground mt-1">
                id, call_id, uuid, external_id
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
