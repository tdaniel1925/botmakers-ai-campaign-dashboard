"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  TestTube,
  Copy,
  Webhook,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  PlayCircle,
  Eye,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Campaign {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "stopped" | "completed";
  webhook_token: string | null;
  call_provider: "vapi" | "autocalls" | "synthflow" | null;
  vapi_key_source: "system" | "client" | null;
  vapi_assistant_id: string | null;
  vapi_phone_number_id: string | null;
  autocalls_assistant_id: number | null;
  synthflow_model_id: string | null;
}

interface TestCall {
  id: string;
  phone_number: string;
  first_name: string | null;
  status: string;
  outcome: string | null;
  duration_seconds: number | null;
  cost: string | null;
  transcript: string | null;
  recording_url: string | null;
  structured_data: Record<string, unknown> | null;
  created_at: string;
  ended_at: string | null;
  vapi_call_id: string | null;
}

export default function OutboundCampaignTestingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [testCalls, setTestCalls] = useState<TestCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [isMakingCall, setIsMakingCall] = useState(false);

  // Test call form
  const [phoneNumber, setPhoneNumber] = useState("");
  const [firstName, setFirstName] = useState("");

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

  const fetchTestCalls = async () => {
    setIsLoadingCalls(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/test-calls`);
      if (!response.ok) throw new Error("Failed to fetch test calls");
      const data = await response.json();
      setTestCalls(data.calls || []);
    } catch (error) {
      console.error("Error fetching test calls:", error);
    } finally {
      setIsLoadingCalls(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
    fetchTestCalls();
  }, [id]);

  // Auto-refresh test calls every 10 seconds when there are pending calls
  useEffect(() => {
    const hasPendingCalls = testCalls.some(
      (call) => call.status === "initiated" || call.status === "ringing" || call.status === "answered"
    );

    if (hasPendingCalls) {
      const interval = setInterval(fetchTestCalls, 5000);
      return () => clearInterval(interval);
    }
  }, [testCalls, id]);

  const handleMakeTestCall = async () => {
    if (!phoneNumber) {
      toast({
        title: "Phone Required",
        description: "Please enter a phone number to call",
        variant: "destructive",
      });
      return;
    }

    setIsMakingCall(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/test-calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          first_name: firstName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate test call");
      }

      toast({
        title: "Test Call Initiated",
        description: `Calling ${phoneNumber}...`,
      });

      // Clear form
      setPhoneNumber("");
      setFirstName("");

      // Refresh test calls list
      fetchTestCalls();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to make test call",
        variant: "destructive",
      });
    } finally {
      setIsMakingCall(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const webhookUrl = campaign?.webhook_token
    ? `${baseUrl}/api/webhooks/outbound/${campaign.webhook_token}`
    : null;

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

  const hasProvider = campaign.call_provider && (
    (campaign.call_provider === "vapi" && campaign.vapi_assistant_id) ||
    (campaign.call_provider === "autocalls" && campaign.autocalls_assistant_id) ||
    (campaign.call_provider === "synthflow" && campaign.synthflow_model_id)
  );

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
          <p className="text-muted-foreground">Testing & Webhook Configuration</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="testing">
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
          <TabsTrigger value="calls" asChild>
            <Link href={`/admin/outbound/${id}/calls`}>
              <Phone className="mr-2 h-4 w-4" />
              Calls
            </Link>
          </TabsTrigger>
          <TabsTrigger value="analytics" asChild>
            <Link href={`/admin/outbound/${id}/analytics`}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Link>
          </TabsTrigger>
          <TabsTrigger value="testing">
            <TestTube className="mr-2 h-4 w-4" />
            Testing
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Make Test Call Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Make a Test Call
            </CardTitle>
            <CardDescription>
              Test your AI agent by placing a call to any phone number
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasProvider ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Please configure a call provider before making test calls.</p>
                <Button asChild className="mt-4">
                  <Link href={`/admin/outbound/${id}`}>Configure Provider</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the phone number to call (any format accepted)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name (Optional)</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                  />
                  <p className="text-xs text-muted-foreground">
                    The AI will use this name when addressing the caller
                  </p>
                </div>

                <Button
                  onClick={handleMakeTestCall}
                  disabled={isMakingCall || !phoneNumber}
                  className="w-full"
                >
                  {isMakingCall ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initiating Call...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-4 w-4" />
                      Make Test Call
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Webhook Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook Configuration
            </CardTitle>
            <CardDescription>
              Configure your call provider to send events to this webhook URL
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              {webhookUrl ? (
                <div className="flex gap-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Webhook token not generated. Contact support.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Webhook Token</Label>
              {campaign.webhook_token ? (
                <div className="flex gap-2">
                  <Input
                    value={campaign.webhook_token}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(campaign.webhook_token!, "Webhook Token")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No token available</p>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> Configure this webhook URL in your call provider settings
                to receive call status updates, transcripts, and structured data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Calls History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Test Call History</CardTitle>
              <CardDescription>
                Recent test calls made from this campaign
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTestCalls}
              disabled={isLoadingCalls}
            >
              {isLoadingCalls ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {testCalls.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No test calls yet. Make your first test call above!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testCalls.map((call) => (
                  <TableRow
                    key={call.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => window.location.href = `/admin/outbound/${id}/testing/${call.id}`}
                  >
                    <TableCell className="font-mono">{call.phone_number}</TableCell>
                    <TableCell>{call.first_name || "-"}</TableCell>
                    <TableCell>{getStatusBadge(call.status)}</TableCell>
                    <TableCell>{getOutcomeBadge(call.outcome)}</TableCell>
                    <TableCell>
                      {call.duration_seconds
                        ? `${Math.floor(call.duration_seconds / 60)}:${String(
                            call.duration_seconds % 60
                          ).padStart(2, "0")}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="View details"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/admin/outbound/${id}/testing/${call.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {call.recording_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title="Listen to recording"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
