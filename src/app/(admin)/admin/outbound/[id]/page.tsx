"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  Square,
  Phone,
  Users,
  Clock,
  DollarSign,
  BarChart3,
  Settings,
  MessageSquare,
  Calendar,
  Bot,
  Save,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  status: "draft" | "active" | "paused" | "stopped" | "completed";
  total_contacts: number;
  contacts_completed: number;
  is_test_mode: boolean;
  test_call_limit: number;
  rate_per_minute: string;
  billing_threshold: string;
  max_concurrent_calls: number;
  retry_enabled: boolean;
  retry_attempts: number;
  retry_delay_minutes: number;
  agent_config: Record<string, unknown> | null;
  structured_data_schema: Array<{ name: string; type: string; description: string; required: boolean }> | null;
  created_at: string;
  updated_at: string;
  launched_at: string | null;
  clients: {
    id: string;
    name: string;
    company_name: string | null;
    email: string;
  } | null;
  campaign_phone_numbers: Array<{
    id: string;
    phone_number: string;
    friendly_name: string | null;
    is_active: boolean;
  }>;
  campaign_schedules: Array<{
    id: string;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    timezone: string;
    is_active: boolean;
  }>;
  stats: {
    totalContacts: number;
    pendingContacts: number;
    completedContacts: number;
    totalCalls: number;
    positiveCalls: number;
    positiveRate: number;
  };
}

export default function OutboundCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rate_per_minute: "",
    billing_threshold: "",
    max_concurrent_calls: 5,
    retry_enabled: true,
    retry_attempts: 2,
    retry_delay_minutes: 60,
    is_test_mode: true,
    test_call_limit: 10,
  });

  const router = useRouter();
  const { toast } = useToast();

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}`);
      if (!response.ok) throw new Error("Failed to fetch campaign");
      const data = await response.json();
      setCampaign(data);
      setFormData({
        name: data.name,
        description: data.description || "",
        rate_per_minute: data.rate_per_minute || "0.15",
        billing_threshold: data.billing_threshold || "100.00",
        max_concurrent_calls: data.max_concurrent_calls || 5,
        retry_enabled: data.retry_enabled ?? true,
        retry_attempts: data.retry_attempts || 2,
        retry_delay_minutes: data.retry_delay_minutes || 60,
        is_test_mode: data.is_test_mode ?? true,
        test_call_limit: data.test_call_limit || 10,
      });
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

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const handleSave = async () => {
    if (!campaign || campaign.status !== "draft") return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          rate_per_minute: parseFloat(formData.rate_per_minute),
          billing_threshold: parseFloat(formData.billing_threshold),
          max_concurrent_calls: formData.max_concurrent_calls,
          retry_enabled: formData.retry_enabled,
          retry_attempts: formData.retry_attempts,
          retry_delay_minutes: formData.retry_delay_minutes,
          is_test_mode: formData.is_test_mode,
          test_call_limit: formData.test_call_limit,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save campaign");
      }

      toast({
        title: "Saved",
        description: "Campaign settings updated successfully",
      });
      fetchCampaign();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save campaign",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAction = async (action: "launch" | "pause" | "resume" | "stop") => {
    setIsActionLoading(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_mode: formData.is_test_mode,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} campaign`);
      }

      const actionMessages = {
        launch: formData.is_test_mode ? "Test mode started" : "Campaign launched",
        pause: "Campaign paused",
        resume: "Campaign resumed",
        stop: "Campaign stopped",
      };

      toast({
        title: "Success",
        description: actionMessages[action],
      });
      fetchCampaign();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} campaign`,
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "paused":
        return <Badge variant="warning">Paused</Badge>;
      case "stopped":
        return <Badge variant="destructive">Stopped</Badge>;
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
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
        <h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
        <Button asChild>
          <Link href="/admin/outbound">Back to Campaigns</Link>
        </Button>
      </div>
    );
  }

  const progress = campaign.total_contacts > 0
    ? Math.round((campaign.contacts_completed / campaign.total_contacts) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/outbound">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
              {campaign.is_test_mode && <Badge variant="outline">Test Mode</Badge>}
            </div>
            <p className="text-muted-foreground">
              {campaign.clients?.name}
              {campaign.clients?.company_name && ` (${campaign.clients.company_name})`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === "draft" && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isActionLoading || campaign.total_contacts === 0}>
                    {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Play className="mr-2 h-4 w-4" />
                    Launch
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Launch Campaign?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {formData.is_test_mode
                        ? `This will start the campaign in test mode, making up to ${formData.test_call_limit} calls.`
                        : "This will start making calls to all contacts. Make sure everything is configured correctly."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleAction("launch")}>
                      Launch
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {campaign.status === "active" && (
            <Button variant="outline" onClick={() => handleAction("pause")} disabled={isActionLoading}>
              {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
          {campaign.status === "paused" && (
            <>
              <Button variant="outline" onClick={() => handleAction("resume")} disabled={isActionLoading}>
                {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Play className="mr-2 h-4 w-4" />
                Resume
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isActionLoading}>
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Stop Campaign?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently stop the campaign. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleAction("stop")}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Stop Campaign
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.stats.totalContacts}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.stats.pendingContacts} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Calls Made
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.stats.totalCalls}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.stats.completedContacts} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Positive Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {campaign.stats.positiveRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {campaign.stats.positiveCalls} positive calls
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress}%</div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
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
        </TabsList>

        <TabsContent value="settings" className="space-y-4 mt-4">
          {/* Campaign Info */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Information</CardTitle>
              <CardDescription>Basic campaign details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={campaign.status !== "draft"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Created</Label>
                  <Input
                    value={format(new Date(campaign.created_at), "PPP")}
                    disabled
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={campaign.status !== "draft"}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Phone Numbers */}
          <Card>
            <CardHeader>
              <CardTitle>Phone Numbers</CardTitle>
              <CardDescription>Numbers used for outbound calls</CardDescription>
            </CardHeader>
            <CardContent>
              {campaign.campaign_phone_numbers.length > 0 ? (
                <div className="space-y-2">
                  {campaign.campaign_phone_numbers.map((phone) => (
                    <div key={phone.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{phone.phone_number}</p>
                          {phone.friendly_name && (
                            <p className="text-sm text-muted-foreground">{phone.friendly_name}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={phone.is_active ? "success" : "secondary"}>
                        {phone.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No phone numbers configured
                </p>
              )}
              {campaign.status === "draft" && (
                <Button variant="outline" className="mt-4" asChild>
                  <Link href={`/admin/outbound/${id}/phone-numbers`}>
                    Manage Phone Numbers
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>When calls are made</CardDescription>
            </CardHeader>
            <CardContent>
              {campaign.campaign_schedules.length > 0 ? (
                <div className="space-y-2">
                  {campaign.campaign_schedules.map((schedule) => (
                    <div key={schedule.id} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4" />
                        <div>
                          <p className="font-medium">
                            {schedule.days_of_week.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {schedule.start_time} - {schedule.end_time} ({schedule.timezone})
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No schedule configured
                </p>
              )}
              {campaign.status === "draft" && (
                <Button variant="outline" className="mt-4" asChild>
                  <Link href={`/admin/outbound/${id}/schedule`}>
                    Manage Schedule
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Call Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Call Settings</CardTitle>
              <CardDescription>Retry and concurrency settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Retry</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically retry unanswered calls
                  </p>
                </div>
                <Switch
                  checked={formData.retry_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, retry_enabled: checked })}
                  disabled={campaign.status !== "draft"}
                />
              </div>
              {formData.retry_enabled && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Retry Attempts</Label>
                    <Input
                      type="number"
                      value={formData.retry_attempts}
                      onChange={(e) => setFormData({ ...formData, retry_attempts: parseInt(e.target.value) || 0 })}
                      disabled={campaign.status !== "draft"}
                      min={1}
                      max={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Retry Delay (minutes)</Label>
                    <Input
                      type="number"
                      value={formData.retry_delay_minutes}
                      onChange={(e) => setFormData({ ...formData, retry_delay_minutes: parseInt(e.target.value) || 0 })}
                      disabled={campaign.status !== "draft"}
                      min={15}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Max Concurrent Calls</Label>
                <Input
                  type="number"
                  value={formData.max_concurrent_calls}
                  onChange={(e) => setFormData({ ...formData, max_concurrent_calls: parseInt(e.target.value) || 1 })}
                  disabled={campaign.status !== "draft"}
                  min={1}
                  max={50}
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing */}
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Rate and threshold settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rate Per Minute ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.rate_per_minute}
                    onChange={(e) => setFormData({ ...formData, rate_per_minute: e.target.value })}
                    disabled={campaign.status !== "draft"}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Threshold ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.billing_threshold}
                    onChange={(e) => setFormData({ ...formData, billing_threshold: e.target.value })}
                    disabled={campaign.status !== "draft"}
                    min={0}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Mode */}
          <Card>
            <CardHeader>
              <CardTitle>Test Mode</CardTitle>
              <CardDescription>Run a limited test before full launch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Test Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Limit calls to test the campaign
                  </p>
                </div>
                <Switch
                  checked={formData.is_test_mode}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_test_mode: checked })}
                  disabled={campaign.status !== "draft"}
                />
              </div>
              {formData.is_test_mode && (
                <div className="space-y-2">
                  <Label>Test Call Limit</Label>
                  <Input
                    type="number"
                    value={formData.test_call_limit}
                    onChange={(e) => setFormData({ ...formData, test_call_limit: parseInt(e.target.value) || 1 })}
                    disabled={campaign.status !== "draft"}
                    min={1}
                    max={100}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
