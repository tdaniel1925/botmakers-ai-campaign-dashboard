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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Key,
  TestTube,
  Copy,
  Webhook,
  Plus,
  Trash2,
  Sparkles,
  GripVertical,
  CalendarClock,
  X,
  MessageCircleOff,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  status: "draft" | "scheduled" | "active" | "paused" | "stopped" | "completed";
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
  scheduled_launch_at: string | null;
  scheduled_timezone: string | null;
  webhook_token: string | null;
  // Provider fields
  call_provider: "vapi" | "autocalls" | "synthflow" | null;
  vapi_key_source: "system" | "client" | null;
  vapi_assistant_id: string | null;
  vapi_phone_number_id: string | null;
  autocalls_assistant_id: number | null;
  synthflow_model_id: string | null;
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
    smsOptedOutCount: number;
  };
}

interface SmsRule {
  id: string;
  campaign_id: string;
  name: string;
  trigger_condition: string;
  message_template: string;
  is_active: boolean;
  priority: number;
  trigger_count: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

// Provider info for display
const PROVIDER_INFO = {
  vapi: {
    name: "Vapi",
    description: "AI voice agents platform",
    docsUrl: "https://docs.vapi.ai",
    appUrl: "https://dashboard.vapi.ai",
  },
  autocalls: {
    name: "AutoCalls.ai",
    description: "Automated calling platform",
    docsUrl: "https://docs.autocalls.ai",
    appUrl: "https://app.autocalls.ai",
  },
  synthflow: {
    name: "Synthflow",
    description: "AI voice automation",
    docsUrl: "https://docs.synthflow.ai",
    appUrl: "https://app.synthflow.ai",
  },
};

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

  // Provider form state
  const [providerData, setProviderData] = useState({
    call_provider: "" as "" | "vapi" | "autocalls" | "synthflow",
    vapi_key_source: "system" as "system" | "client",
    vapi_api_key: "",
    vapi_assistant_id: "",
    vapi_phone_number_id: "",
    autocalls_api_key: "",
    autocalls_assistant_id: "",
    synthflow_api_key: "",
    synthflow_model_id: "",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    provider: string;
    assistant?: { id: string; name: string };
    phoneNumber?: { id: string; number: string; name?: string };
    error?: string;
  } | null>(null);
  const [isSavingProvider, setIsSavingProvider] = useState(false);

  // SMS Rules state
  const [smsRules, setSmsRules] = useState<SmsRule[]>([]);
  const [isLoadingSmsRules, setIsLoadingSmsRules] = useState(false);
  const [isSavingSmsRule, setIsSavingSmsRule] = useState(false);
  const [editingRule, setEditingRule] = useState<SmsRule | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    trigger_condition: "",
    message_template: "",
    priority: 0,
  });

  // Schedule launch state
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledTimezone, setScheduledTimezone] = useState("America/New_York");
  const [isScheduling, setIsScheduling] = useState(false);

  // Common US Timezones
  const TIMEZONES = [
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Phoenix", label: "Arizona Time" },
    { value: "America/Anchorage", label: "Alaska Time" },
    { value: "Pacific/Honolulu", label: "Hawaii Time" },
  ];

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
      setProviderData({
        call_provider: data.call_provider || "",
        vapi_key_source: data.vapi_key_source || "system",
        vapi_api_key: "", // Never returned from server for security
        vapi_assistant_id: data.vapi_assistant_id || "",
        vapi_phone_number_id: data.vapi_phone_number_id || "",
        autocalls_api_key: "", // Never returned from server for security
        autocalls_assistant_id: data.autocalls_assistant_id?.toString() || "",
        synthflow_api_key: "", // Never returned from server for security
        synthflow_model_id: data.synthflow_model_id || "",
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
    fetchSmsRules();
  }, [id]);

  // Fetch SMS rules
  const fetchSmsRules = async () => {
    setIsLoadingSmsRules(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/sms-rules`);
      if (response.ok) {
        const data = await response.json();
        setSmsRules(data.rules || []);
      }
    } catch (error) {
      console.error("Error fetching SMS rules:", error);
    } finally {
      setIsLoadingSmsRules(false);
    }
  };

  // Add new SMS rule
  const handleAddSmsRule = async () => {
    if (!newRule.name.trim() || !newRule.trigger_condition.trim() || !newRule.message_template.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSavingSmsRule(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/sms-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create SMS rule");
      }

      toast({ title: "Success", description: "SMS rule created successfully" });
      setNewRule({ name: "", trigger_condition: "", message_template: "", priority: 0 });
      setShowAddRule(false);
      fetchSmsRules();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create SMS rule",
        variant: "destructive",
      });
    } finally {
      setIsSavingSmsRule(false);
    }
  };

  // Update SMS rule
  const handleUpdateSmsRule = async () => {
    if (!editingRule) return;

    setIsSavingSmsRule(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/sms-rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: editingRule.id,
          name: editingRule.name,
          trigger_condition: editingRule.trigger_condition,
          message_template: editingRule.message_template,
          is_active: editingRule.is_active,
          priority: editingRule.priority,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update SMS rule");
      }

      toast({ title: "Success", description: "SMS rule updated successfully" });
      setEditingRule(null);
      fetchSmsRules();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update SMS rule",
        variant: "destructive",
      });
    } finally {
      setIsSavingSmsRule(false);
    }
  };

  // Delete SMS rule
  const handleDeleteSmsRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/sms-rules?ruleId=${ruleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete SMS rule");
      }

      toast({ title: "Success", description: "SMS rule deleted successfully" });
      fetchSmsRules();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete SMS rule",
        variant: "destructive",
      });
    }
  };

  // Toggle SMS rule active status
  const handleToggleSmsRule = async (rule: SmsRule) => {
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/sms-rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: rule.id,
          is_active: !rule.is_active,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update rule");
      }

      fetchSmsRules();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update SMS rule",
        variant: "destructive",
      });
    }
  };

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

  // Schedule campaign launch
  const handleScheduleLaunch = async () => {
    if (!scheduledDate || !scheduledTime) {
      toast({
        title: "Error",
        description: "Please select a date and time",
        variant: "destructive",
      });
      return;
    }

    setIsScheduling(true);
    try {
      // Create date in the selected timezone and convert to UTC for storage
      // Parse the date/time as if it were in the selected timezone
      const localDateString = `${scheduledDate}T${scheduledTime}:00`;

      // Get the timezone offset for the selected timezone
      const tzDate = new Date(localDateString);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: scheduledTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      // Convert local time in timezone to UTC
      // We need to find what UTC time corresponds to the given time in the target timezone
      const parts = formatter.formatToParts(tzDate);
      const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";

      // Calculate UTC time by using Intl API to get proper offset
      const tempDate = new Date(localDateString);
      const utcFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      // Get the offset between UTC and target timezone at this date/time
      const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: scheduledTimezone }));
      const utcNow = new Date(new Date().toLocaleString("en-US", { timeZone: "UTC" }));
      const offsetMs = tzNow.getTime() - utcNow.getTime();

      // Adjust: subtract the offset to get UTC time
      const scheduledAtUTC = new Date(tempDate.getTime() - offsetMs);

      // Validate it's in the future
      if (scheduledAtUTC <= new Date()) {
        toast({
          title: "Error",
          description: "Scheduled time must be in the future",
          variant: "destructive",
        });
        setIsScheduling(false);
        return;
      }

      const response = await fetch(`/api/admin/outbound-campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_launch_at: scheduledAtUTC.toISOString(),
          scheduled_timezone: scheduledTimezone,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to schedule campaign");
      }

      const tzLabel = TIMEZONES.find(tz => tz.value === scheduledTimezone)?.label || scheduledTimezone;
      toast({
        title: "Scheduled",
        description: `Campaign will launch on ${scheduledDate} at ${scheduledTime} ${tzLabel}`,
      });
      setShowScheduleDialog(false);
      setScheduledDate("");
      setScheduledTime("");
      setScheduledTimezone("America/New_York");
      fetchCampaign();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to schedule campaign",
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
    }
  };

  // Cancel scheduled launch
  const handleCancelSchedule = async () => {
    setIsScheduling(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_launch_at: null,
          status: "draft",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel schedule");
      }

      toast({
        title: "Cancelled",
        description: "Scheduled launch has been cancelled",
      });
      fetchCampaign();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel schedule",
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
    }
  };

  // Verify provider connection
  const verifyProviderConnection = async () => {
    setIsVerifying(true);
    setVerificationResult(null);

    try {
      let apiKey = "";
      let assistantId = "";
      let modelId = "";
      let phoneNumberId = "";

      let useSystemKey = false;

      switch (providerData.call_provider) {
        case "vapi":
          if (providerData.vapi_key_source === "system") {
            useSystemKey = true;
          } else {
            apiKey = providerData.vapi_api_key;
          }
          assistantId = providerData.vapi_assistant_id;
          phoneNumberId = providerData.vapi_phone_number_id;
          break;
        case "autocalls":
          apiKey = providerData.autocalls_api_key;
          assistantId = providerData.autocalls_assistant_id;
          break;
        case "synthflow":
          apiKey = providerData.synthflow_api_key;
          modelId = providerData.synthflow_model_id;
          break;
      }

      if (!apiKey && !useSystemKey) {
        toast({
          title: "API Key Required",
          description: "Please enter an API key to verify the connection.",
          variant: "destructive",
        });
        setIsVerifying(false);
        return;
      }

      const response = await fetch("/api/admin/outbound-campaigns/verify-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerData.call_provider,
          api_key: apiKey || undefined,
          assistant_id: assistantId || undefined,
          model_id: modelId || undefined,
          phone_number_id: phoneNumberId || undefined,
          use_system_key: useSystemKey,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setVerificationResult({
          success: false,
          provider: providerData.call_provider,
          error: result.error || "Verification failed",
        });
        toast({
          title: "Verification Failed",
          description: result.error || "Could not verify provider connection",
          variant: "destructive",
        });
      } else {
        setVerificationResult(result);
        toast({
          title: "Connection Verified!",
          description: result.assistant?.name
            ? `Successfully connected to "${result.assistant.name}"`
            : "API key is valid",
        });
      }
    } catch (error) {
      console.error("Verification error:", error);
      setVerificationResult({
        success: false,
        provider: providerData.call_provider,
        error: "Failed to verify connection",
      });
      toast({
        title: "Error",
        description: "Failed to verify provider connection",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Save provider settings
  const handleSaveProvider = async () => {
    if (!campaign || campaign.status !== "draft") return;
    setIsSavingProvider(true);
    setVerificationResult(null);

    try {
      const updateData: Record<string, unknown> = {
        call_provider: providerData.call_provider || null,
      };

      switch (providerData.call_provider) {
        case "vapi":
          updateData.vapi_key_source = providerData.vapi_key_source;
          updateData.vapi_assistant_id = providerData.vapi_assistant_id || null;
          updateData.vapi_phone_number_id = providerData.vapi_phone_number_id || null;
          if (providerData.vapi_api_key && providerData.vapi_key_source === "client") {
            updateData.vapi_api_key = providerData.vapi_api_key;
          }
          // Clear other providers
          updateData.autocalls_assistant_id = null;
          updateData.synthflow_model_id = null;
          updateData.provider_api_key = null;
          break;
        case "autocalls":
          updateData.autocalls_assistant_id = providerData.autocalls_assistant_id
            ? parseInt(providerData.autocalls_assistant_id, 10)
            : null;
          if (providerData.autocalls_api_key) {
            updateData.provider_api_key = providerData.autocalls_api_key;
          }
          // Clear other providers
          updateData.vapi_assistant_id = null;
          updateData.vapi_phone_number_id = null;
          updateData.vapi_api_key = null;
          updateData.synthflow_model_id = null;
          break;
        case "synthflow":
          updateData.synthflow_model_id = providerData.synthflow_model_id || null;
          if (providerData.synthflow_api_key) {
            updateData.provider_api_key = providerData.synthflow_api_key;
          }
          // Clear other providers
          updateData.vapi_assistant_id = null;
          updateData.vapi_phone_number_id = null;
          updateData.vapi_api_key = null;
          updateData.autocalls_assistant_id = null;
          break;
      }

      const response = await fetch(`/api/admin/outbound-campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save provider settings");
      }

      toast({
        title: "Saved",
        description: "Provider settings updated successfully",
      });
      fetchCampaign();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save provider settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingProvider(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "scheduled":
        return <Badge variant="outline" className="border-blue-500 text-blue-600">Scheduled</Badge>;
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
              <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={campaign.total_contacts === 0}>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Schedule Campaign Launch</DialogTitle>
                    <DialogDescription>
                      Set a date, time, and timezone for the campaign to automatically launch.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="schedule-date">Date</Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="schedule-time">Time</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="schedule-timezone">Timezone</Label>
                      <Select
                        value={scheduledTimezone}
                        onValueChange={setScheduledTimezone}
                      >
                        <SelectTrigger id="schedule-timezone">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {scheduledDate && scheduledTime && (
                      <p className="text-sm text-muted-foreground">
                        Campaign will launch on {scheduledDate} at {scheduledTime} {TIMEZONES.find(tz => tz.value === scheduledTimezone)?.label}
                      </p>
                    )}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Note:</strong> Once launched, calls will only be made during the hours defined in your campaign schedule.
                        Each contact will be called according to their local timezone to ensure calls happen during appropriate business hours.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleScheduleLaunch} disabled={isScheduling || !scheduledDate || !scheduledTime}>
                      {isScheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Schedule Launch
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          {campaign.status === "scheduled" && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                <span>
                  Launches {campaign.scheduled_launch_at && formatDistanceToNow(new Date(campaign.scheduled_launch_at), { addSuffix: true })}
                </span>
                <span className="text-xs">
                  ({campaign.scheduled_launch_at && format(new Date(campaign.scheduled_launch_at), "PPp")}
                  {campaign.scheduled_timezone && ` ${TIMEZONES.find(tz => tz.value === campaign.scheduled_timezone)?.label || campaign.scheduled_timezone}`})
                </span>
              </div>
              <Button variant="outline" onClick={handleCancelSchedule} disabled={isScheduling}>
                {isScheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <X className="mr-2 h-4 w-4" />
                Cancel Schedule
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isActionLoading}>
                    {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Play className="mr-2 h-4 w-4" />
                    Launch Now
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Launch Campaign Now?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel the scheduled launch and start the campaign immediately.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleAction("launch")}>
                      Launch Now
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

      {/* SMS Opted-Out Contacts Warning */}
      {campaign.stats.smsOptedOutCount > 0 && (
        <Card className="border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/50">
                <MessageCircleOff className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-800 dark:text-orange-200">
                  {campaign.stats.smsOptedOutCount} Contact{campaign.stats.smsOptedOutCount !== 1 ? "s" : ""} Opted Out of SMS
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  These contacts have requested to stop receiving text messages and will not receive any SMS follow-ups.
                  This is a global blacklist that applies across all campaigns and clients.
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                  Only platform administrators can remove contacts from the SMS blacklist.
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {campaign.stats.smsOptedOutCount}
                </div>
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  of {campaign.stats.totalContacts}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
          <TabsTrigger value="testing" asChild>
            <Link href={`/admin/outbound/${id}/testing`}>
              <TestTube className="mr-2 h-4 w-4" />
              Testing
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

          {/* Call Provider */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Call Provider
              </CardTitle>
              <CardDescription>
                Configure the AI calling provider and credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={providerData.call_provider}
                  onValueChange={(value: "" | "vapi" | "autocalls" | "synthflow") => {
                    setProviderData({ ...providerData, call_provider: value });
                    setVerificationResult(null);
                  }}
                  disabled={campaign.status !== "draft"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vapi">Vapi</SelectItem>
                    <SelectItem value="autocalls">AutoCalls.ai</SelectItem>
                    <SelectItem value="synthflow">Synthflow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Provider Info */}
              {providerData.call_provider && PROVIDER_INFO[providerData.call_provider] && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Key className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        {PROVIDER_INFO[providerData.call_provider].name}
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {PROVIDER_INFO[providerData.call_provider].description}
                        {" — "}
                        <a
                          href={PROVIDER_INFO[providerData.call_provider].appUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline inline-flex items-center gap-1"
                        >
                          Open Dashboard <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vapi Configuration */}
              {providerData.call_provider === "vapi" && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>API Key Source</Label>
                    <Select
                      value={providerData.vapi_key_source}
                      onValueChange={(value: "system" | "client") => {
                        setProviderData({ ...providerData, vapi_key_source: value, vapi_api_key: "" });
                        setVerificationResult(null);
                      }}
                      disabled={campaign.status !== "draft"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">Use System Keys</SelectItem>
                        <SelectItem value="client">Use Client API Key</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {providerData.vapi_key_source === "client" && (
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={providerData.vapi_api_key}
                          onChange={(e) => {
                            setProviderData({ ...providerData, vapi_api_key: e.target.value });
                            setVerificationResult(null);
                          }}
                          placeholder="Enter Vapi API key"
                          disabled={campaign.status !== "draft"}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {campaign.call_provider === "vapi" && campaign.vapi_key_source === "client"
                          ? "API key is saved (enter new key to change)"
                          : "Enter your Vapi API key from the dashboard"}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Assistant ID *</Label>
                    <Input
                      value={providerData.vapi_assistant_id}
                      onChange={(e) => {
                        setProviderData({ ...providerData, vapi_assistant_id: e.target.value });
                        setVerificationResult(null);
                      }}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      disabled={campaign.status !== "draft"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone Number ID *</Label>
                    <Input
                      value={providerData.vapi_phone_number_id}
                      onChange={(e) => setProviderData({ ...providerData, vapi_phone_number_id: e.target.value })}
                      placeholder="Your Vapi phone number ID for outbound calls"
                      disabled={campaign.status !== "draft"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Find this in Vapi Dashboard → Phone Numbers. Required for making outbound calls.
                    </p>
                  </div>
                </div>
              )}

              {/* AutoCalls Configuration */}
              {providerData.call_provider === "autocalls" && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>API Key *</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={providerData.autocalls_api_key}
                        onChange={(e) => {
                          setProviderData({ ...providerData, autocalls_api_key: e.target.value });
                          setVerificationResult(null);
                        }}
                        placeholder="Enter AutoCalls.ai API key"
                        disabled={campaign.status !== "draft"}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {campaign.call_provider === "autocalls"
                        ? "API key is saved (enter new key to change)"
                        : "Get your API key from AutoCalls.ai dashboard"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Assistant ID *</Label>
                    <Input
                      value={providerData.autocalls_assistant_id}
                      onChange={(e) => {
                        setProviderData({ ...providerData, autocalls_assistant_id: e.target.value });
                        setVerificationResult(null);
                      }}
                      placeholder="Enter assistant ID (numeric)"
                      disabled={campaign.status !== "draft"}
                    />
                  </div>
                </div>
              )}

              {/* Synthflow Configuration */}
              {providerData.call_provider === "synthflow" && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>API Key *</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={providerData.synthflow_api_key}
                        onChange={(e) => {
                          setProviderData({ ...providerData, synthflow_api_key: e.target.value });
                          setVerificationResult(null);
                        }}
                        placeholder="Enter Synthflow API key"
                        disabled={campaign.status !== "draft"}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {campaign.call_provider === "synthflow"
                        ? "API key is saved (enter new key to change)"
                        : "Get your API key from Synthflow dashboard"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Agent ID (model_id) *</Label>
                    <Input
                      value={providerData.synthflow_model_id}
                      onChange={(e) => {
                        setProviderData({ ...providerData, synthflow_model_id: e.target.value });
                        setVerificationResult(null);
                      }}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      disabled={campaign.status !== "draft"}
                    />
                  </div>
                </div>
              )}

              {/* Verification Result */}
              {verificationResult && (
                <div className={`rounded-lg p-4 ${
                  verificationResult.success
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}>
                  <div className="flex gap-3">
                    {verificationResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                      {verificationResult.success ? (
                        <>
                          <p className="font-medium text-green-700 dark:text-green-300">
                            Connection Verified!
                          </p>
                          {verificationResult.assistant && (
                            <p className="text-sm text-green-600 dark:text-green-400">
                              Assistant: {verificationResult.assistant.name}
                            </p>
                          )}
                          {verificationResult.phoneNumber && (
                            <p className="text-sm text-green-600 dark:text-green-400">
                              Phone Number: {verificationResult.phoneNumber.number}
                              {verificationResult.phoneNumber.name && ` (${verificationResult.phoneNumber.name})`}
                            </p>
                          )}
                          {providerData.call_provider === "vapi" && !verificationResult.phoneNumber && providerData.vapi_phone_number_id && (
                            <p className="text-sm text-yellow-600 dark:text-yellow-400">
                              Phone number not verified - check the Phone Number ID
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-red-700 dark:text-red-300">
                          {verificationResult.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {providerData.call_provider && campaign.status === "draft" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={verifyProviderConnection}
                    disabled={isVerifying}
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : verificationResult?.success ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                        Re-verify
                      </>
                    ) : (
                      <>
                        <TestTube className="mr-2 h-4 w-4" />
                        Verify Connection
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSaveProvider}
                    disabled={isSavingProvider}
                  >
                    {isSavingProvider && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Provider
                  </Button>
                </div>
              )}

              {/* Current Provider Info (read-only for non-draft) */}
              {campaign.status !== "draft" && campaign.call_provider && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">
                      {PROVIDER_INFO[campaign.call_provider]?.name || campaign.call_provider}
                    </Badge>
                    {campaign.call_provider === "vapi" && campaign.vapi_assistant_id && (
                      <span className="text-muted-foreground">
                        Assistant: {campaign.vapi_assistant_id.slice(0, 8)}...
                      </span>
                    )}
                    {campaign.call_provider === "autocalls" && campaign.autocalls_assistant_id && (
                      <span className="text-muted-foreground">
                        Assistant: {campaign.autocalls_assistant_id}
                      </span>
                    )}
                    {campaign.call_provider === "synthflow" && campaign.synthflow_model_id && (
                      <span className="text-muted-foreground">
                        Agent: {campaign.synthflow_model_id.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                </div>
              )}
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

          {/* SMS Rules - Intent-Based */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                SMS Follow-up Rules
              </CardTitle>
              <CardDescription>
                AI-powered intent-based SMS triggers. After each call, AI analyzes the conversation
                and sends SMS messages when it detects matching intents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingSmsRules ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Existing Rules */}
                  {smsRules.length > 0 ? (
                    <div className="space-y-3">
                      {smsRules.map((rule) => (
                        <div
                          key={rule.id}
                          className={`border rounded-lg p-4 space-y-3 ${
                            !rule.is_active ? "opacity-60 bg-muted/30" : ""
                          }`}
                        >
                          {editingRule?.id === rule.id ? (
                            // Edit mode
                            <div className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Rule Name</Label>
                                  <Input
                                    value={editingRule.name}
                                    onChange={(e) =>
                                      setEditingRule({ ...editingRule, name: e.target.value })
                                    }
                                    placeholder="e.g., Send Scheduling Link"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Priority (higher = evaluated first)</Label>
                                  <Input
                                    type="number"
                                    value={editingRule.priority}
                                    onChange={(e) =>
                                      setEditingRule({
                                        ...editingRule,
                                        priority: parseInt(e.target.value) || 0,
                                      })
                                    }
                                    min={0}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-blue-500" />
                                  Trigger Condition (AI Intent)
                                </Label>
                                <Textarea
                                  value={editingRule.trigger_condition}
                                  onChange={(e) =>
                                    setEditingRule({
                                      ...editingRule,
                                      trigger_condition: e.target.value,
                                    })
                                  }
                                  placeholder="Describe when this SMS should be sent, e.g., 'Customer expressed interest in scheduling an appointment'"
                                  rows={2}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Message Template</Label>
                                <Textarea
                                  value={editingRule.message_template}
                                  onChange={(e) =>
                                    setEditingRule({
                                      ...editingRule,
                                      message_template: e.target.value,
                                    })
                                  }
                                  placeholder="Hi {{first_name}}, thanks for your interest! Here's the link to schedule: {{link}}"
                                  rows={3}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Variables: {"{{first_name}}"}, {"{{last_name}}"}, {"{{phone}}"}, {"{{company}}"}, {"{{link}}"}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleUpdateSmsRule}
                                  disabled={isSavingSmsRule}
                                >
                                  {isSavingSmsRule && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Save Changes
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingRule(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View mode
                            <>
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{rule.name}</span>
                                  <Badge variant={rule.is_active ? "success" : "secondary"}>
                                    {rule.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                  {rule.priority > 0 && (
                                    <Badge variant="outline">Priority: {rule.priority}</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Switch
                                    checked={rule.is_active}
                                    onCheckedChange={() => handleToggleSmsRule(rule)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingRule(rule)}
                                  >
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete SMS Rule?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently delete the &quot;{rule.name}&quot; SMS rule.
                                          This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteSmsRule(rule.id)}
                                          className="bg-destructive text-destructive-foreground"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                                <div className="flex items-start gap-2 text-sm">
                                  <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                                      Trigger when AI detects:
                                    </span>
                                    <p className="text-blue-800 dark:text-blue-200 mt-1">
                                      &quot;{rule.trigger_condition}&quot;
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="text-sm">
                                <span className="text-muted-foreground">Message: </span>
                                <span className="italic">{rule.message_template}</span>
                              </div>
                              {rule.trigger_count > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  Triggered {rule.trigger_count} time{rule.trigger_count !== 1 ? "s" : ""}
                                  {rule.last_triggered_at && (
                                    <span>
                                      {" "}· Last: {formatDistanceToNow(new Date(rule.last_triggered_at), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p>No SMS rules configured yet</p>
                      <p className="text-sm">Add intent-based rules to automatically send SMS after calls</p>
                    </div>
                  )}

                  {/* Add New Rule Form */}
                  {showAddRule ? (
                    <Card className="border-dashed">
                      <CardContent className="pt-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">New SMS Rule</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowAddRule(false);
                              setNewRule({ name: "", trigger_condition: "", message_template: "", priority: 0 });
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Rule Name *</Label>
                            <Input
                              value={newRule.name}
                              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                              placeholder="e.g., Send Appointment Confirmation"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Priority</Label>
                            <Input
                              type="number"
                              value={newRule.priority}
                              onChange={(e) =>
                                setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })
                              }
                              min={0}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-500" />
                            Trigger Condition (AI Intent) *
                          </Label>
                          <Textarea
                            value={newRule.trigger_condition}
                            onChange={(e) =>
                              setNewRule({ ...newRule, trigger_condition: e.target.value })
                            }
                            placeholder="Describe in natural language when this SMS should be sent, e.g., 'Customer showed interest in the product and asked for more information'"
                            rows={2}
                          />
                          <p className="text-xs text-muted-foreground">
                            AI will analyze call transcripts and trigger this rule when the conversation matches this intent
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Message Template *</Label>
                          <Textarea
                            value={newRule.message_template}
                            onChange={(e) =>
                              setNewRule({ ...newRule, message_template: e.target.value })
                            }
                            placeholder="Hi {{first_name}}! Thanks for chatting with us. Here's the info you requested: {{link}}"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground">
                            Available variables: {"{{first_name}}"}, {"{{last_name}}"}, {"{{phone}}"}, {"{{company}}"}, {"{{link}}"}
                          </p>
                        </div>
                        <Button onClick={handleAddSmsRule} disabled={isSavingSmsRule}>
                          {isSavingSmsRule && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Plus className="mr-2 h-4 w-4" />
                          Add Rule
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Button variant="outline" onClick={() => setShowAddRule(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add SMS Rule
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
