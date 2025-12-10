"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Settings2,
  Phone,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Edit2,
  Save,
  X,
  TrendingUp,
  Tag,
  BarChart3,
  BookOpen,
  Webhook,
  PhoneIncoming,
  Trash2,
  Send,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface InboundCampaign {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  is_active: boolean;
  status: string;
  webhook_token: string;
  payload_mapping: Record<string, unknown> | null;
  total_calls: number;
  calls_completed: number;
  positive_outcomes: number;
  negative_outcomes: number;
  total_minutes: string;
  created_at: string;
  updated_at: string;
  launched_at: string | null;
  clients?: {
    id: string;
    name: string;
    company_name?: string;
    email?: string;
  };
  campaign_phone_numbers?: Array<{
    id: string;
    phone_number: string;
    friendly_name: string | null;
    provider: string;
    is_active: boolean;
  }>;
  inbound_campaign_outcome_tags?: Array<{
    id: string;
    tag_name: string;
    tag_color: string | null;
    is_positive: boolean | null;
    sort_order: number | null;
  }>;
}

interface WebhookLog {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface InboundCall {
  id: string;
  campaign_id: string;
  vapi_call_id: string | null;
  external_call_id: string | null;
  caller_phone: string | null;
  status: string;
  duration_seconds: number | null;
  transcript: string | null;
  audio_url: string | null;
  ai_summary: string | null;
  ai_sentiment: string | null;
  ai_key_points: string[] | null;
  outcome_tag_id: string | null;
  error_message: string | null;
  created_at: string;
  inbound_campaign_outcome_tags?: {
    id: string;
    tag_name: string;
    tag_color: string | null;
    is_positive: boolean | null;
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
  sentAt: string | null;
  createdAt: string;
}

export default function InboundCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<InboundCampaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: "", description: "" });
  const [copied, setCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [calls, setCalls] = useState<InboundCall[]>([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [callsTotal, setCallsTotal] = useState(0);
  const [callsPage, setCallsPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<InboundCall | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [isLoadingSms, setIsLoadingSms] = useState(false);

  const fetchCampaign = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/inbound-campaigns/${campaignId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Campaign not found",
            description: "This campaign may have been deleted.",
            variant: "destructive",
          });
          router.push("/admin/inbound");
          return;
        }
        throw new Error("Failed to fetch campaign");
      }
      const data = await response.json();
      setCampaign(data);
      setEditData({ name: data.name, description: data.description || "" });
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
  }, [campaignId, router, toast]);

  const fetchWebhookLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const response = await fetch(`/api/admin/inbound-campaigns/${campaignId}/webhook-logs`);
      if (response.ok) {
        const data = await response.json();
        setWebhookLogs(data);
      }
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [campaignId]);

  const fetchCalls = useCallback(async (page = 1) => {
    setIsLoadingCalls(true);
    try {
      const response = await fetch(`/api/admin/inbound-campaigns/${campaignId}/calls?page=${page}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setCalls(data.calls);
        setCallsTotal(data.total);
        setCallsPage(page);
      }
    } catch (error) {
      console.error("Error fetching calls:", error);
    } finally {
      setIsLoadingCalls(false);
    }
  }, [campaignId]);

  const fetchSmsLogs = useCallback(async (callId: string) => {
    setIsLoadingSms(true);
    setSmsLogs([]);
    try {
      const response = await fetch(
        `/api/admin/inbound-campaigns/${campaignId}/calls/${callId}/sms`
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
  }, [campaignId]);

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

  useEffect(() => {
    if (selectedCall) {
      fetchSmsLogs(selectedCall.id);
    } else {
      setSmsLogs([]);
    }
  }, [selectedCall?.id, fetchSmsLogs]);

  useEffect(() => {
    fetchCampaign();
    fetchWebhookLogs();
    fetchCalls();

    // Set up real-time subscriptions for live updates
    const supabase = createClient();

    const channel = supabase
      .channel(`inbound-campaign-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbound_campaign_calls",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          // Refresh calls and campaign stats when a call changes
          fetchCalls(callsPage);
          fetchCampaign();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbound_campaign_webhook_logs",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          // Refresh webhook logs when new log arrives
          fetchWebhookLogs();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "inbound_campaigns",
          filter: `id=eq.${campaignId}`,
        },
        () => {
          // Refresh campaign when it's updated
          fetchCampaign();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCampaign, fetchWebhookLogs, fetchCalls, campaignId, callsPage]);

  const copyWebhookUrl = () => {
    if (!campaign) return;
    const webhookUrl = `${window.location.origin}/api/webhooks/${campaign.webhook_token}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({ title: "Copied!", description: "Webhook URL copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!campaign) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/inbound-campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editData.name,
          description: editData.description || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      const updated = await response.json();
      setCampaign({ ...campaign, ...updated });
      setIsEditing(false);
      toast({ title: "Saved", description: "Campaign updated successfully" });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (isActive: boolean) => {
    if (!campaign) return;
    try {
      const response = await fetch(`/api/admin/inbound-campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (!response.ok) throw new Error("Failed to update");

      setCampaign({ ...campaign, is_active: isActive });
      toast({
        title: isActive ? "Campaign Activated" : "Campaign Paused",
        description: isActive
          ? "Campaign is now receiving webhooks"
          : "Campaign is paused and will reject webhooks",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update campaign status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/inbound-campaigns/${campaignId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast({
        title: "Campaign Deleted",
        description: "The campaign has been permanently deleted",
      });
      router.push("/admin/inbound");
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete campaign",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
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
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Campaign not found</h2>
        <p className="text-muted-foreground mb-4">This campaign may have been deleted.</p>
        <Button onClick={() => router.push("/admin/inbound")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Campaigns
        </Button>
      </div>
    );
  }

  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/${campaign.webhook_token}`;
  const positiveRate = campaign.calls_completed > 0
    ? Math.round((campaign.positive_outcomes / campaign.calls_completed) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/inbound">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="text-2xl font-bold h-auto py-1"
                />
                <Textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Campaign description..."
                  className="text-sm"
                  rows={2}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
                  <Badge variant={campaign.is_active ? "default" : "secondary"}>
                    {campaign.is_active ? "Active" : "Paused"}
                  </Badge>
                </div>
                {campaign.description && (
                  <p className="text-muted-foreground mt-1">{campaign.description}</p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  Client: {campaign.clients?.name}
                  {campaign.clients?.company_name && ` (${campaign.clients.company_name})`}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit2 className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <PhoneIncoming className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{campaign.total_calls || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{campaign.calls_completed || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Positive Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <span className="text-2xl font-bold">{positiveRate}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Minutes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">
                {parseFloat(campaign.total_minutes || "0").toFixed(1)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="calls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calls">
            <Phone className="mr-2 h-4 w-4" /> Calls
          </TabsTrigger>
          <TabsTrigger value="webhook">
            <Webhook className="mr-2 h-4 w-4" /> Webhook
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 className="mr-2 h-4 w-4" /> Settings
          </TabsTrigger>
          <TabsTrigger value="outcome-tags">
            <Tag className="mr-2 h-4 w-4" /> Outcome Tags
          </TabsTrigger>
          <TabsTrigger value="sms-rules">
            <MessageSquare className="mr-2 h-4 w-4" /> SMS Rules
          </TabsTrigger>
        </TabsList>

        {/* Calls Tab */}
        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Call History</CardTitle>
                  <CardDescription>
                    {callsTotal} total calls received via webhook
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchCalls(callsPage)}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingCalls ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCalls && calls.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : calls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No calls received yet</p>
                  <p className="text-sm">Calls will appear here when webhooks are received</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {calls.map((call) => (
                    <div
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="shrink-0">
                          {call.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : call.status === "failed" ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {call.caller_phone || "Unknown Caller"}
                            </span>
                            {call.inbound_campaign_outcome_tags && (
                              <Badge
                                style={{
                                  backgroundColor: call.inbound_campaign_outcome_tags.tag_color || "#6b7280",
                                  color: "#fff",
                                }}
                              >
                                {call.inbound_campaign_outcome_tags.tag_name}
                              </Badge>
                            )}
                            {call.ai_sentiment && (
                              <Badge variant={
                                call.ai_sentiment === "positive" ? "default" :
                                call.ai_sentiment === "negative" ? "destructive" : "secondary"
                              }>
                                {call.ai_sentiment}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            {call.duration_seconds !== null && (
                              <span>{Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, "0")}</span>
                            )}
                            <span>{formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {call.transcript && (
                          <Badge variant="outline">Has Transcript</Badge>
                        )}
                        {call.audio_url && (
                          <Badge variant="outline">Has Audio</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {callsTotal > 20 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Page {callsPage} of {Math.ceil(callsTotal / 20)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={callsPage <= 1}
                      onClick={() => fetchCalls(callsPage - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={callsPage >= Math.ceil(callsTotal / 20)}
                      onClick={() => fetchCalls(callsPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call Detail Modal */}
          {selectedCall && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Call Details</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedCall(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Caller Phone</Label>
                    <p className="font-mono">{selectedCall.caller_phone || "Unknown"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p className="capitalize">{selectedCall.status}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Duration</Label>
                    <p>{selectedCall.duration_seconds ? `${Math.floor(selectedCall.duration_seconds / 60)}:${String(selectedCall.duration_seconds % 60).padStart(2, "0")}` : "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Received</Label>
                    <p>{format(new Date(selectedCall.created_at), "PPpp")}</p>
                  </div>
                </div>

                {selectedCall.ai_summary && (
                  <div>
                    <Label className="text-muted-foreground">AI Summary</Label>
                    <p className="mt-1 p-3 bg-muted rounded-lg text-sm">{selectedCall.ai_summary}</p>
                  </div>
                )}

                {selectedCall.ai_key_points && selectedCall.ai_key_points.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Key Points</Label>
                    <ul className="mt-1 space-y-1">
                      {selectedCall.ai_key_points.map((point, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedCall.transcript && (
                  <div>
                    <Label className="text-muted-foreground">Transcript</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg text-sm max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                      {selectedCall.transcript}
                    </div>
                  </div>
                )}

                {selectedCall.audio_url && (
                  <div>
                    <Label className="text-muted-foreground">Recording</Label>
                    <audio controls className="w-full mt-1">
                      <source src={selectedCall.audio_url} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}

                {selectedCall.error_message && (
                  <div>
                    <Label className="text-muted-foreground text-red-600">Error</Label>
                    <p className="mt-1 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm text-red-600">
                      {selectedCall.error_message}
                    </p>
                  </div>
                )}

                {/* SMS Follow-up */}
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    SMS Follow-up
                  </Label>
                  <div className="mt-1">
                    {isLoadingSms ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : smsLogs.length === 0 ? (
                      <div className="text-center py-3 text-muted-foreground text-sm bg-muted/50 rounded-lg">
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
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Webhook Tab */}
        <TabsContent value="webhook" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook Configuration
              </CardTitle>
              <CardDescription>
                Send call data from your AI voice provider to this URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-muted-foreground">
                    When disabled, webhooks will be rejected with 400 error
                  </p>
                </div>
                <Switch
                  checked={campaign.is_active}
                  onCheckedChange={handleToggleActive}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recent Webhook Logs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Webhook Activity</CardTitle>
                  <CardDescription>Last 10 webhook requests</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchWebhookLogs}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingLogs ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {webhookLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No webhook activity yet</p>
                  <p className="text-sm">Send a test request to see it here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {webhookLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        {log.status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">
                          {log.error_message || "Request processed successfully"}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <Link href={`/admin/inbound/${campaignId}/analytics`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-5 w-5" />
                    View Analytics
                  </CardTitle>
                  <CardDescription>
                    Detailed call analytics, trends, and insights
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <Link href={`/admin/inbound/${campaignId}/payload-guide`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-5 w-5" />
                    Payload Guide
                  </CardTitle>
                  <CardDescription>
                    Configure field mappings and view payload structure
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
              <CardDescription>
                Configure campaign behavior and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="font-medium">
                    {format(new Date(campaign.created_at), "PPP")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Updated</Label>
                  <p className="font-medium">
                    {format(new Date(campaign.updated_at), "PPP")}
                  </p>
                </div>
                {campaign.launched_at && (
                  <div>
                    <Label className="text-muted-foreground">Launched</Label>
                    <p className="font-medium">
                      {format(new Date(campaign.launched_at), "PPP")}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Webhook Token</Label>
                  <p className="font-mono text-sm">{campaign.webhook_token}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outcome Tags Tab */}
        <TabsContent value="outcome-tags" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Outcome Tags</CardTitle>
                  <CardDescription>
                    Define tags to categorize call outcomes
                  </CardDescription>
                </div>
                <Link href={`/admin/inbound/${campaignId}/outcome-tags`}>
                  <Button>
                    <Settings2 className="mr-2 h-4 w-4" /> Manage Tags
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {campaign.inbound_campaign_outcome_tags &&
              campaign.inbound_campaign_outcome_tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {campaign.inbound_campaign_outcome_tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      style={{
                        backgroundColor: tag.tag_color || "#6b7280",
                        color: "#fff",
                      }}
                    >
                      {tag.tag_name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No outcome tags configured</p>
                  <Link href={`/admin/inbound/${campaignId}/outcome-tags`}>
                    <Button variant="link" className="mt-2">
                      Add your first tag
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Rules Tab */}
        <TabsContent value="sms-rules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SMS Rules</CardTitle>
                  <CardDescription>
                    Configure automated SMS responses based on call outcomes
                  </CardDescription>
                </div>
                <Link href={`/admin/inbound/${campaignId}/sms-rules`}>
                  <Button>
                    <Settings2 className="mr-2 h-4 w-4" /> Manage Rules
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Configure AI-powered SMS triggers</p>
                <Link href={`/admin/inbound/${campaignId}/sms-rules`}>
                  <Button variant="link" className="mt-2">
                    Set up SMS rules
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{campaign.name}&quot;? This action cannot
              be undone and will permanently delete all associated calls, logs, and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
