"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
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
  Play,
  Zap,
  Settings2,
  FileJson,
  Phone,
  FileText,
  Music,
  Timer,
  Hash,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  GripVertical,
  MessageSquare,
  Edit2,
  Save,
  X,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Tag,
  BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

// ============= Types =============
interface CampaignData {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  is_active: boolean;
  webhook_token: string;
  payload_mapping: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  clients?: { name: string; company_name?: string };
}

interface WebhookLog {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  payload: Record<string, unknown>;
}

interface OutcomeTagRow {
  id: string;
  campaign_id: string;
  tag_name: string;
  tag_color: string | null;
  is_positive: boolean | null;
  sort_order: number | null;
  created_at: string;
}

interface SmsRuleRow {
  id: string;
  campaign_id: string;
  name: string;
  trigger_condition: string;
  message_template: string;
  is_active: boolean;
  priority: number;
  trigger_count: number | null;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CampaignStats {
  totalCalls: number;
  completedCalls: number;
  avgDuration: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  outcomeDistribution: Array<{
    tagName: string;
    tagColor: string;
    count: number;
  }>;
  callsOverTime: Array<{
    date: string;
    count: number;
  }>;
  topKeywords: Array<{
    word: string;
    count: number;
  }>;
}

interface CallRow {
  id: string;
  caller_phone: string | null;
  call_duration: number | null;
  ai_sentiment: string | null;
  ai_summary: string | null;
  status: string;
  created_at: string;
  campaign_outcome_tags: {
    tag_name: string;
    tag_color: string;
  }[] | null;
}

interface TestResult {
  success: boolean;
  message: string;
  type?: string;
  detected?: {
    transcript: string | null;
    audioUrl: string | null;
    phone: string | null;
    duration: number | null;
    callId: string | null;
  };
  callId?: string;
}

// ============= Platform Presets =============
const PLATFORM_PRESETS = {
  vapi: {
    name: "Vapi",
    description: "Voice AI platform",
    logo: "🤖",
    docsUrl: "https://docs.vapi.ai/webhooks",
    samplePayload: {
      type: "end-of-call-report",
      call: { id: "call_abc123", customer: { number: "+1234567890" } },
      artifact: {
        transcript: "AI: Hello! Customer: Hi, I need help.",
        recordingUrl: "https://storage.vapi.ai/recordings/call_abc123.wav",
        duration: 300
      }
    }
  },
  autocalls: {
    name: "AutoCalls.ai",
    description: "AI outbound calling",
    logo: "📞",
    docsUrl: "https://autocalls.ai/docs/webhooks",
    samplePayload: {
      call_id: "ac_call_xyz789",
      contact_phone: "+1987654321",
      call_duration_seconds: 180,
      formatted_transcript: "AI: Good morning! John: Yes?",
      recording_url: "https://storage.autocalls.ai/recordings/ac_call_xyz789.mp3"
    }
  },
  bland: {
    name: "Bland AI",
    description: "Enterprise AI calling",
    logo: "🎙️",
    docsUrl: "https://docs.bland.ai/webhooks",
    samplePayload: {
      call_id: "bland_123abc",
      to: "+1555123456",
      call_length: 245,
      transcript: "Agent: Hello! Sarah: Speaking.",
      recording_url: "https://api.bland.ai/recordings/bland_123abc"
    }
  },
  custom: {
    name: "Custom",
    description: "Any JSON webhook",
    logo: "⚙️",
    docsUrl: null,
    samplePayload: {
      transcript: "Your call transcript...",
      phone: "+1234567890",
      duration: 120,
      recording_url: "https://your-platform.com/recordings/123"
    }
  }
};

type PlatformKey = keyof typeof PLATFORM_PRESETS;

const DEFAULT_COLORS = [
  "#22c55e", "#ef4444", "#f59e0b", "#3b82f6",
  "#8b5cf6", "#ec4899", "#6b7280", "#14b8a6"
];

// ============= Helper Functions =============
function analyzePayload(payload: Record<string, unknown>) {
  const findValue = (obj: unknown, keys: string[]): unknown => {
    if (!obj || typeof obj !== "object") return undefined;
    const record = obj as Record<string, unknown>;
    for (const key of keys) {
      if (key in record && record[key]) return record[key];
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
        if (current) return current;
      }
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const found = findValue(value, keys);
        if (found) return found;
      }
    }
    return undefined;
  };

  const transcriptKeys = ["formatted_transcript", "transcript", "transcription", "text", "artifact.transcript"];
  const audioUrlKeys = ["recording_url", "recordingUrl", "audio_url", "artifact.recordingUrl"];
  const phoneKeys = ["from", "phone", "caller", "contact_phone", "customer.number", "to"];
  const durationKeys = ["duration", "call_duration", "call_length", "artifact.duration", "call_duration_seconds"];
  const callIdKeys = ["id", "call_id", "callId", "uuid"];

  return {
    hasTranscript: !!findValue(payload, transcriptKeys),
    hasAudioUrl: !!findValue(payload, audioUrlKeys),
    hasPhone: !!findValue(payload, phoneKeys),
    hasDuration: !!findValue(payload, durationKeys),
    hasCallId: !!findValue(payload, callIdKeys),
  };
}

function DetectionBadge({ detected, label, icon: Icon }: {
  detected: boolean;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
      detected
        ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
        : "bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-900/30 dark:border-gray-700"
    }`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
      {detected ? <CheckCircle2 className="h-4 w-4 ml-auto" /> : <XCircle className="h-4 w-4 ml-auto opacity-50" />}
    </div>
  );
}

// ============= Main Component =============
export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  // Campaign state
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Webhook state
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [copied, setCopied] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>("vapi");
  const [testPayload, setTestPayload] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [previewAnalysis, setPreviewAnalysis] = useState<ReturnType<typeof analyzePayload> | null>(null);

  // Outcome Tags state
  const [tags, setTags] = useState<OutcomeTagRow[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_COLORS[0]);
  const [newTagPositive, setNewTagPositive] = useState(false);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);

  // SMS Rules state
  const [smsRules, setSmsRules] = useState<SmsRuleRow[]>([]);
  const [newRuleName, setNewRuleName] = useState("");
  const [newTriggerCondition, setNewTriggerCondition] = useState("");
  const [newMessageTemplate, setNewMessageTemplate] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editRuleName, setEditRuleName] = useState("");
  const [editRuleCondition, setEditRuleCondition] = useState("");
  const [editRuleMessage, setEditRuleMessage] = useState("");
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  // Analytics state
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [period, setPeriod] = useState<string>("30d");

  // Calls list state
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [callsPage, setCallsPage] = useState(1);
  const [callsTotalPages, setCallsTotalPages] = useState(1);
  const [callsLoading, setCallsLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRow | null>(null);
  const callsPageSize = 10;

  const webhookUrl = campaign
    ? `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/api/webhooks/${campaign.webhook_token}`
    : "";

  // ============= Data Fetching =============
  const fetchCampaign = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/campaigns/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch campaign");
      const data = await response.json();
      setCampaign(data);
      setName(data.name);
      setDescription(data.description || "");
      setIsActive(data.is_active);
    } catch {
      toast({ title: "Error", description: "Failed to load campaign", variant: "destructive" });
      router.push("/admin/campaigns");
    }
  }, [params.id, router, toast]);

  const fetchWebhookLogs = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/campaigns/${params.id}/webhook-logs`);
      if (response.ok) {
        const data = await response.json();
        setWebhookLogs(data.slice(0, 10));
      }
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
    }
  }, [params.id]);

  const fetchTags = useCallback(async () => {
    const { data, error } = await supabase
      .from("campaign_outcome_tags")
      .select("*")
      .eq("campaign_id", params.id)
      .order("sort_order");
    if (!error) setTags(data || []);
  }, [params.id, supabase]);

  const fetchSmsRules = useCallback(async () => {
    const { data, error } = await supabase
      .from("sms_rules")
      .select("*")
      .eq("campaign_id", params.id)
      .order("priority", { ascending: false });
    if (!error) setSmsRules(data || []);
  }, [params.id, supabase]);

  const fetchCalls = useCallback(async (page: number = 1) => {
    setCallsLoading(true);
    try {
      const from = (page - 1) * callsPageSize;
      const to = from + callsPageSize - 1;

      const { data, count, error } = await supabase
        .from("calls")
        .select(`
          id, caller_phone, call_duration, ai_sentiment, ai_summary, status, created_at,
          campaign_outcome_tags (tag_name, tag_color)
        `, { count: "exact" })
        .eq("campaign_id", params.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      setCalls((data || []) as CallRow[]);
      setCallsTotalPages(Math.ceil((count || 0) / callsPageSize));
    } catch (error) {
      console.error("Error fetching calls:", error);
    } finally {
      setCallsLoading(false);
    }
  }, [params.id, supabase, callsPageSize]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const fromDate = dateRange.from ? startOfDay(dateRange.from) : subDays(new Date(), 30);
      const toDate = dateRange.to ? endOfDay(dateRange.to) : new Date();

      const { data: calls, error } = await supabase
        .from("calls")
        .select(`id, call_duration, ai_sentiment, outcome_tag_id, created_at, transcript,
          campaign_outcome_tags (tag_name, tag_color)`)
        .eq("campaign_id", params.id)
        .eq("status", "completed")
        .gte("created_at", fromDate.toISOString())
        .lte("created_at", toDate.toISOString());

      if (error) throw error;

      const totalCalls = calls?.length || 0;
      const completedCalls = calls?.filter(c => c.ai_sentiment !== null).length || 0;
      const totalDuration = calls?.reduce((sum, c) => sum + (c.call_duration || 0), 0) || 0;
      const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

      const sentimentBreakdown = {
        positive: calls?.filter(c => c.ai_sentiment === "positive").length || 0,
        neutral: calls?.filter(c => c.ai_sentiment === "neutral").length || 0,
        negative: calls?.filter(c => c.ai_sentiment === "negative").length || 0,
      };

      const outcomeMap = new Map<string, { tagName: string; tagColor: string; count: number }>();
      calls?.forEach(call => {
        if (call.campaign_outcome_tags) {
          const tagData = call.campaign_outcome_tags as unknown;
          const tag = Array.isArray(tagData) && tagData.length > 0
            ? tagData[0] as { tag_name: string; tag_color: string }
            : tagData as { tag_name: string; tag_color: string };
          if (tag?.tag_name) {
            const existing = outcomeMap.get(tag.tag_name);
            if (existing) existing.count++;
            else outcomeMap.set(tag.tag_name, { tagName: tag.tag_name, tagColor: tag.tag_color, count: 1 });
          }
        }
      });
      const outcomeDistribution = Array.from(outcomeMap.values()).sort((a, b) => b.count - a.count);

      const callsByDate = new Map<string, number>();
      calls?.forEach(call => {
        const date = format(new Date(call.created_at), "yyyy-MM-dd");
        callsByDate.set(date, (callsByDate.get(date) || 0) + 1);
      });
      const callsOverTime = Array.from(callsByDate.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const wordCounts = new Map<string, number>();
      const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "and", "or", "but", "if", "then", "when", "at", "by", "for", "with", "to", "from", "in", "out", "on", "i", "you", "he", "she", "it", "we", "they", "what", "this", "that"]);
      calls?.forEach(call => {
        if (call.transcript) {
          const words = call.transcript.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/)
            .filter((w: string) => w.length > 3 && !stopWords.has(w));
          words.forEach((word: string) => wordCounts.set(word, (wordCounts.get(word) || 0) + 1));
        }
      });
      const topKeywords = Array.from(wordCounts.entries())
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setStats({ totalCalls, completedCalls, avgDuration, sentimentBreakdown, outcomeDistribution, callsOverTime, topKeywords });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  }, [params.id, dateRange, supabase]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      await Promise.all([fetchCampaign(), fetchWebhookLogs(), fetchTags(), fetchSmsRules(), fetchAnalytics(), fetchCalls(1)]);
      setIsLoading(false);
    }
    loadData();
  }, [fetchCampaign, fetchWebhookLogs, fetchTags, fetchSmsRules, fetchAnalytics, fetchCalls]);

  // Handle calls pagination
  useEffect(() => {
    if (!isLoading) {
      fetchCalls(callsPage);
    }
  }, [callsPage, fetchCalls, isLoading]);

  useEffect(() => {
    const preset = PLATFORM_PRESETS[selectedPlatform];
    setTestPayload(JSON.stringify(preset.samplePayload, null, 2));
    setPreviewAnalysis(analyzePayload(preset.samplePayload));
  }, [selectedPlatform]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(testPayload);
      setPreviewAnalysis(analyzePayload(parsed));
    } catch {
      setPreviewAnalysis(null);
    }
  }, [testPayload]);

  // ============= Handlers =============
  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/campaigns/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, is_active: isActive }),
      });
      if (!response.ok) throw new Error("Failed to update campaign");
      toast({ title: "Saved", description: "Campaign updated successfully." });
      fetchCampaign();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({ title: "Copied!", description: "Webhook URL copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const payload = JSON.parse(testPayload);
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      setTestResult({
        success: response.ok,
        message: result.message || (response.ok ? "Webhook processed!" : result.error || "Unknown error"),
        type: result.type,
        callId: result.callId,
      });
      setTimeout(fetchWebhookLogs, 500);
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : "Invalid JSON" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const { data, error } = await supabase
        .from("campaign_outcome_tags")
        .insert({ campaign_id: params.id, tag_name: newTagName, tag_color: newTagColor, is_positive: newTagPositive, sort_order: tags.length })
        .select()
        .single();
      if (error) throw error;
      setTags([...tags, data]);
      setNewTagName("");
      setNewTagColor(DEFAULT_COLORS[(tags.length + 1) % DEFAULT_COLORS.length]);
      setNewTagPositive(false);
      toast({ title: "Tag added", description: `"${newTagName}" created` });
    } catch {
      toast({ title: "Error", description: "Failed to add tag", variant: "destructive" });
    }
  };

  const confirmDeleteTag = async () => {
    if (!deleteTagId) return;
    try {
      await supabase.from("campaign_outcome_tags").delete().eq("id", deleteTagId);
      setTags(tags.filter(t => t.id !== deleteTagId));
      toast({ title: "Deleted", description: "Tag removed" });
    } catch {
      toast({ title: "Error", description: "Failed to delete tag", variant: "destructive" });
    } finally {
      setDeleteTagId(null);
    }
  };

  const handleAddSmsRule = async () => {
    if (!newRuleName.trim() || !newTriggerCondition.trim() || !newMessageTemplate.trim()) {
      toast({ title: "Error", description: "All fields required", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase
        .from("sms_rules")
        .insert({ campaign_id: params.id, name: newRuleName, trigger_condition: newTriggerCondition, message_template: newMessageTemplate, priority: smsRules.length, is_active: true })
        .select()
        .single();
      if (error) throw error;
      setSmsRules([data, ...smsRules]);
      setNewRuleName("");
      setNewTriggerCondition("");
      setNewMessageTemplate("");
      toast({ title: "Rule added", description: `"${newRuleName}" will trigger SMS` });
    } catch {
      toast({ title: "Error", description: "Failed to add rule", variant: "destructive" });
    }
  };

  const confirmDeleteRule = async () => {
    if (!deleteRuleId) return;
    try {
      await supabase.from("sms_rules").delete().eq("id", deleteRuleId);
      setSmsRules(smsRules.filter(r => r.id !== deleteRuleId));
      toast({ title: "Deleted", description: "SMS rule removed" });
    } catch {
      toast({ title: "Error", description: "Failed to delete rule", variant: "destructive" });
    } finally {
      setDeleteRuleId(null);
    }
  };

  const handleToggleSmsRule = async (ruleId: string, isActiveState: boolean) => {
    try {
      await supabase.from("sms_rules").update({ is_active: isActiveState }).eq("id", ruleId);
      setSmsRules(smsRules.map(r => r.id === ruleId ? { ...r, is_active: isActiveState } : r));
    } catch {
      toast({ title: "Error", description: "Failed to update rule", variant: "destructive" });
    }
  };

  const startEditingRule = (rule: SmsRuleRow) => {
    setEditingRuleId(rule.id);
    setEditRuleName(rule.name);
    setEditRuleCondition(rule.trigger_condition);
    setEditRuleMessage(rule.message_template);
  };

  const saveEditingRule = async () => {
    if (!editingRuleId) return;
    try {
      await supabase.from("sms_rules")
        .update({ name: editRuleName, trigger_condition: editRuleCondition, message_template: editRuleMessage, updated_at: new Date().toISOString() })
        .eq("id", editingRuleId);
      setSmsRules(smsRules.map(r => r.id === editingRuleId
        ? { ...r, name: editRuleName, trigger_condition: editRuleCondition, message_template: editRuleMessage }
        : r));
      toast({ title: "Saved", description: "Rule updated" });
      setEditingRuleId(null);
    } catch {
      toast({ title: "Error", description: "Failed to save rule", variant: "destructive" });
    }
  };

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    const now = new Date();
    switch (value) {
      case "7d": setDateRange({ from: subDays(now, 7), to: now }); break;
      case "30d": setDateRange({ from: subDays(now, 30), to: now }); break;
      case "90d": setDateRange({ from: subDays(now, 90), to: now }); break;
      case "all": setDateRange({ from: subDays(now, 365), to: now }); break;
    }
  };

  useEffect(() => {
    if (!isLoading) fetchAnalytics();
  }, [dateRange, isLoading, fetchAnalytics]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getConnectionStatus = () => {
    if (webhookLogs.length === 0) return { status: "unknown", message: "No webhooks yet" };
    const recentLog = webhookLogs[0];
    const recentTime = new Date(recentLog.created_at);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (recentLog.status === "success" && recentTime > hourAgo) return { status: "healthy", message: "Connected" };
    if (recentLog.status === "failed") return { status: "error", message: "Last failed" };
    return { status: "idle", message: "Idle" };
  };

  const connectionStatus = getConnectionStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/campaigns">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{campaign?.name}</h1>
              {campaign?.is_active ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {campaign?.clients?.name}{campaign?.clients?.company_name ? ` • ${campaign.clients.company_name}` : ""}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
          connectionStatus.status === "healthy"
            ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800"
            : connectionStatus.status === "error"
            ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800"
            : "bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-900/30 dark:border-gray-700"
        }`}>
          {connectionStatus.status === "healthy" ? (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          ) : connectionStatus.status === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">{connectionStatus.message}</span>
        </div>
      </div>

      {/* Webhook URL - Always Visible */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Webhook URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-background p-3 rounded-lg border font-mono break-all">
              {webhookUrl}
            </code>
            <Button variant="default" onClick={handleCopyWebhook}>
              {copied ? <><Check className="h-4 w-4 mr-2" />Copied!</> : <><Copy className="h-4 w-4 mr-2" />Copy</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="webhook" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Webhook
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="sms" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Rules
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Settings</CardTitle>
                <CardDescription>Update campaign details</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveCampaign} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Campaign Name *</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                  <Button type="submit" disabled={isSaving} className="w-full">
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Last 30 days performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Phone className="h-4 w-4" />
                      <span className="text-sm">Total Calls</span>
                    </div>
                    <p className="text-2xl font-bold">{stats?.totalCalls || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Avg Duration</span>
                    </div>
                    <p className="text-2xl font-bold">{formatDuration(stats?.avgDuration || 0)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Positive Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {stats?.totalCalls ? Math.round((stats.sentimentBreakdown.positive / stats.totalCalls) * 100) : 0}%
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Tag className="h-4 w-4" />
                      <span className="text-sm">Outcome Tags</span>
                    </div>
                    <p className="text-2xl font-bold">{tags.length}</p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Created {campaign?.created_at && format(new Date(campaign.created_at), "MMM d, yyyy")}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Calls */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Calls</CardTitle>
                  <CardDescription>
                    {stats?.totalCalls || 0} total calls in this campaign
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchCalls(callsPage)} disabled={callsLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${callsLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {callsLoading && calls.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : calls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Phone className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium">No calls yet</p>
                  <p className="text-sm">Calls will appear here once received via webhook</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {calls.map((call) => {
                      const tagData = call.campaign_outcome_tags as { tag_name: string; tag_color: string } | null;
                      return (
                        <div
                          key={call.id}
                          onClick={() => setSelectedCall(call)}
                          className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          {/* Status Icon */}
                          <div className={`p-2 rounded-full ${
                            call.ai_sentiment === "positive"
                              ? "bg-green-100 dark:bg-green-950/50"
                              : call.ai_sentiment === "negative"
                              ? "bg-red-100 dark:bg-red-950/50"
                              : "bg-gray-100 dark:bg-gray-800/50"
                          }`}>
                            {call.ai_sentiment === "positive" ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : call.ai_sentiment === "negative" ? (
                              <XCircle className="h-5 w-5 text-red-600" />
                            ) : (
                              <Phone className="h-5 w-5 text-gray-600" />
                            )}
                          </div>

                          {/* Main Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm">{call.caller_phone || "Unknown"}</span>
                              {tagData && (
                                <Badge style={{ backgroundColor: tagData.tag_color, color: "#fff" }} className="text-xs">
                                  {tagData.tag_name}
                                </Badge>
                              )}
                              {call.status === "processing" && (
                                <Badge variant="secondary" className="text-xs">Processing</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {call.ai_summary || "No summary available"}
                            </p>
                          </div>

                          {/* Duration */}
                          <div className="text-right shrink-0">
                            <div className="text-sm font-medium">
                              {call.call_duration ? formatDuration(call.call_duration) : "-"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                            </div>
                          </div>

                          {/* Arrow */}
                          <Eye className="h-5 w-5 text-muted-foreground shrink-0" />
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {callsTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Page {callsPage} of {callsTotalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCallsPage(p => Math.max(1, p - 1))}
                          disabled={callsPage === 1 || callsLoading}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCallsPage(p => Math.min(callsTotalPages, p + 1))}
                          disabled={callsPage === callsTotalPages || callsLoading}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Call Detail Modal */}
          <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Phone className="h-5 w-5" />
                  {selectedCall?.caller_phone || "Unknown Caller"}
                </DialogTitle>
                <DialogDescription>
                  {selectedCall?.created_at && format(new Date(selectedCall.created_at), "MMM d, yyyy 'at' h:mm a")}
                  {selectedCall?.call_duration && ` • ${formatDuration(selectedCall.call_duration)}`}
                </DialogDescription>
              </DialogHeader>
              {selectedCall && (
                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-4">
                    <Badge variant={
                      selectedCall.ai_sentiment === "positive" ? "success" :
                      selectedCall.ai_sentiment === "negative" ? "destructive" : "secondary"
                    }>
                      {selectedCall.ai_sentiment || "Unknown"} sentiment
                    </Badge>
                    {(() => {
                      const tagData = selectedCall.campaign_outcome_tags as { tag_name: string; tag_color: string } | null;
                      return tagData && (
                        <Badge style={{ backgroundColor: tagData.tag_color, color: "#fff" }}>
                          {tagData.tag_name}
                        </Badge>
                      );
                    })()}
                  </div>
                  {selectedCall.ai_summary && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">AI Summary</h4>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        {selectedCall.ai_summary}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Webhook Tab */}
        <TabsContent value="webhook" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Platform Setup */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Setup</CardTitle>
                <CardDescription>Select your AI calling platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {(Object.entries(PLATFORM_PRESETS) as [PlatformKey, typeof PLATFORM_PRESETS[PlatformKey]][]).map(([key, platform]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedPlatform(key)}
                      className={`p-3 rounded-lg border-2 text-left transition-all hover:border-primary/50 ${
                        selectedPlatform === key ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="text-xl mb-1">{platform.logo}</div>
                      <div className="font-medium text-sm">{platform.name}</div>
                      <div className="text-xs text-muted-foreground">{platform.description}</div>
                    </button>
                  ))}
                </div>
                {PLATFORM_PRESETS[selectedPlatform].docsUrl && (
                  <a href={PLATFORM_PRESETS[selectedPlatform].docsUrl!} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    View {PLATFORM_PRESETS[selectedPlatform].name} docs
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Auto-Detection Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  Smart Auto-Detection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 p-2 rounded border bg-card">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm">Transcript</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded border bg-card">
                    <Phone className="h-4 w-4 text-primary" />
                    <span className="text-sm">Phone Number</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded border bg-card">
                    <Music className="h-4 w-4 text-primary" />
                    <span className="text-sm">Recording URL</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded border bg-card">
                    <Timer className="h-4 w-4 text-primary" />
                    <span className="text-sm">Duration</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded border bg-card">
                    <Hash className="h-4 w-4 text-primary" />
                    <span className="text-sm">Call ID</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Test Webhook */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Test Webhook
              </CardTitle>
              <CardDescription>Send a test payload to verify your setup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <Textarea
                    value={testPayload}
                    onChange={(e) => setTestPayload(e.target.value)}
                    className="font-mono text-xs min-h-[200px]"
                    placeholder="Enter JSON payload..."
                  />
                  <Button onClick={handleTestWebhook} disabled={isTesting || !testPayload} className="w-full">
                    {isTesting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : <><Play className="h-4 w-4 mr-2" />Send Test</>}
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="text-sm font-medium mb-2">Detection Preview</div>
                  {previewAnalysis ? (
                    <div className="grid gap-2">
                      <DetectionBadge detected={previewAnalysis.hasTranscript} label="Transcript" icon={FileText} />
                      <DetectionBadge detected={previewAnalysis.hasPhone} label="Phone" icon={Phone} />
                      <DetectionBadge detected={previewAnalysis.hasAudioUrl} label="Recording" icon={Music} />
                      <DetectionBadge detected={previewAnalysis.hasDuration} label="Duration" icon={Timer} />
                      <DetectionBadge detected={previewAnalysis.hasCallId} label="Call ID" icon={Hash} />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileJson className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Invalid JSON</p>
                    </div>
                  )}
                  {testResult && (
                    <div className={`p-3 rounded-lg ${testResult.success ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                        <span className={`text-sm font-medium ${testResult.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                          {testResult.message}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Logs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Webhook Logs</CardTitle>
                  <CardDescription>Last 10 webhook requests</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchWebhookLogs}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {webhookLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No webhooks received yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {webhookLogs.map((log) => {
                    const analysis = analyzePayload(log.payload);
                    const isPing = log.error_message === "Ping received (no transcript)";
                    return (
                      <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-3">
                          {log.status === "success" ? (
                            isPing ? <Zap className="h-4 w-4 text-blue-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <Badge variant={log.status === "success" ? (isPing ? "secondary" : "success") : "destructive"}>
                            {isPing ? "Ping" : log.status === "success" ? "Call" : "Failed"}
                          </Badge>
                          <div className="flex gap-1">
                            {analysis.hasTranscript && <FileText className="h-3 w-3 text-green-500" />}
                            {analysis.hasPhone && <Phone className="h-3 w-3 text-green-500" />}
                            {analysis.hasAudioUrl && <Music className="h-3 w-3 text-green-500" />}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at.endsWith("Z") ? log.created_at : log.created_at + "Z"), { addSuffix: true })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outcome Tags Tab */}
        <TabsContent value="tags" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Current Tags ({tags.length})</CardTitle>
                <CardDescription>AI uses these to categorize calls</CardDescription>
              </CardHeader>
              <CardContent>
                {tags.length > 0 ? (
                  <div className="space-y-3">
                    {tags.map((tag) => (
                      <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Badge style={{ backgroundColor: tag.tag_color || "#6b7280", color: "#fff" }}>
                            {tag.tag_name}
                          </Badge>
                          {tag.is_positive && (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">Positive</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={tag.is_positive || false}
                            onCheckedChange={async (checked) => {
                              await supabase.from("campaign_outcome_tags").update({ is_positive: checked }).eq("id", tag.id);
                              setTags(tags.map(t => t.id === tag.id ? { ...t, is_positive: checked } : t));
                            }}
                          />
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTagId(tag.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No tags yet. Add your first outcome tag.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add New Tag</CardTitle>
                <CardDescription>Create outcome categories</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tagName">Tag Name</Label>
                  <Input id="tagName" placeholder="e.g., Interested, Not Available" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_COLORS.map((color) => (
                      <button key={color} type="button"
                        className={`w-8 h-8 rounded-full border-2 ${newTagColor === color ? "border-gray-900 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewTagColor(color)}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="isPositive" checked={newTagPositive} onCheckedChange={setNewTagPositive} />
                  <Label htmlFor="isPositive">Positive outcome</Label>
                </div>
                <div className="pt-2">
                  <Label>Preview</Label>
                  <div className="mt-2">
                    <Badge style={{ backgroundColor: newTagColor, color: "#fff" }}>{newTagName || "Tag Name"}</Badge>
                  </div>
                </div>
                <Button onClick={handleAddTag} disabled={!newTagName.trim()} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />Add Tag
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SMS Rules Tab */}
        <TabsContent value="sms" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Plus className="mr-2 h-5 w-5" />Add New Rule</CardTitle>
                <CardDescription>Define when to send SMS</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input placeholder="e.g., Send application link" value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Trigger Condition</Label>
                  <Textarea placeholder="e.g., If caller wants to apply for a loan" value={newTriggerCondition} onChange={(e) => setNewTriggerCondition(e.target.value)} rows={2} />
                  <p className="text-xs text-muted-foreground">AI analyzes each call to match this condition</p>
                </div>
                <div className="space-y-2">
                  <Label>SMS Message <span className="text-xs text-muted-foreground">({newMessageTemplate.length}/160)</span></Label>
                  <Textarea placeholder="Thank you for your interest! Apply here..." value={newMessageTemplate} onChange={(e) => setNewMessageTemplate(e.target.value)} rows={3} maxLength={1600} />
                </div>
                <Button onClick={handleAddSmsRule} disabled={!newRuleName.trim() || !newTriggerCondition.trim() || !newMessageTemplate.trim()} className="w-full">
                  <MessageSquare className="mr-2 h-4 w-4" />Add Rule
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Zap className="mr-2 h-5 w-5" />Active Rules ({smsRules.length})</CardTitle>
                <CardDescription>SMS triggers when conditions match</CardDescription>
              </CardHeader>
              <CardContent>
                {smsRules.length > 0 ? (
                  <div className="space-y-4">
                    {smsRules.map((rule) => (
                      <div key={rule.id} className="border rounded-lg p-4 space-y-3">
                        {editingRuleId === rule.id ? (
                          <div className="space-y-3">
                            <Input value={editRuleName} onChange={(e) => setEditRuleName(e.target.value)} placeholder="Rule name" />
                            <Textarea value={editRuleCondition} onChange={(e) => setEditRuleCondition(e.target.value)} placeholder="Trigger condition" rows={2} />
                            <Textarea value={editRuleMessage} onChange={(e) => setEditRuleMessage(e.target.value)} placeholder="SMS message" rows={3} />
                            <div className="flex space-x-2">
                              <Button size="sm" onClick={saveEditingRule}><Save className="mr-1 h-3 w-3" />Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingRuleId(null)}><X className="mr-1 h-3 w-3" />Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium">{rule.name}</h4>
                                  <Badge variant={rule.is_active ? "default" : "secondary"} className={rule.is_active ? "bg-green-500" : ""}>
                                    {rule.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                                {rule.trigger_count && rule.trigger_count > 0 && (
                                  <p className="text-xs text-muted-foreground">Triggered {rule.trigger_count} times</p>
                                )}
                              </div>
                              <Switch checked={rule.is_active} onCheckedChange={(checked) => handleToggleSmsRule(rule.id, checked)} />
                            </div>
                            <div className="text-sm space-y-2">
                              <div><span className="text-muted-foreground">When: </span>{rule.trigger_condition}</div>
                              <div><span className="text-muted-foreground">Send: </span>
                                <span className="bg-muted px-2 py-1 rounded text-xs font-mono">
                                  {rule.message_template.length > 80 ? rule.message_template.substring(0, 80) + "..." : rule.message_template}
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-end space-x-2 pt-2 border-t">
                              <Button variant="ghost" size="sm" onClick={() => startEditingRule(rule)}><Edit2 className="h-3 w-3 mr-1" />Edit</Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteRuleId(rule.id)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="h-3 w-3 mr-1" />Delete
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No SMS rules yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center justify-end gap-4">
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePicker dateRange={dateRange} onDateRangeChange={(range) => { if (range) { setDateRange(range); setPeriod("custom"); } }} />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalCalls || 0}</div>
                <p className="text-xs text-muted-foreground">{stats?.completedCalls || 0} analyzed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(stats?.avgDuration || 0)}</div>
                <p className="text-xs text-muted-foreground">per call</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Positive Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats?.totalCalls ? Math.round((stats.sentimentBreakdown.positive / stats.totalCalls) * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">{stats?.sentimentBreakdown.positive || 0} positive</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outcomes</CardTitle>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.outcomeDistribution.length || 0}</div>
                <p className="text-xs text-muted-foreground">unique outcomes</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {stats && stats.totalCalls > 0 ? (
                  <div className="space-y-4">
                    {["positive", "neutral", "negative"].map((sentiment) => {
                      const count = stats.sentimentBreakdown[sentiment as keyof typeof stats.sentimentBreakdown];
                      const pct = Math.round((count / stats.totalCalls) * 100);
                      const color = sentiment === "positive" ? "bg-green-500" : sentiment === "negative" ? "bg-red-500" : "bg-gray-400";
                      return (
                        <div key={sentiment} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center">
                              <span className={`w-3 h-3 rounded-full ${color} mr-2`}></span>
                              {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                            </span>
                            <span>{count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outcome Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.outcomeDistribution.map((outcome, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: outcome.tagColor }}></span>
                        <span className="text-sm">{outcome.tagName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ backgroundColor: outcome.tagColor, width: `${(outcome.count / (stats?.totalCalls || 1)) * 100}%` }}></div>
                        </div>
                        <span className="text-sm text-muted-foreground w-8 text-right">{outcome.count}</span>
                      </div>
                    </div>
                  ))}
                  {(!stats?.outcomeDistribution || stats.outcomeDistribution.length === 0) && (
                    <p className="text-muted-foreground text-center py-8">No outcomes tagged</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Calls Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.callsOverTime && stats.callsOverTime.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-end gap-1 h-32">
                      {stats.callsOverTime.slice(-14).map((day, index) => {
                        const maxCount = Math.max(...stats.callsOverTime.map(d => d.count));
                        const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                        return (
                          <div key={index} className="flex-1 bg-primary/20 rounded-t relative group" style={{ height: `${Math.max(height, 4)}%` }}>
                            <div className="absolute bottom-0 left-0 right-0 bg-primary rounded-t" style={{ height: `${height}%` }}></div>
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                              {day.count}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{stats.callsOverTime.length > 0 ? format(new Date(stats.callsOverTime[Math.max(0, stats.callsOverTime.length - 14)].date), "MMM d") : ""}</span>
                      <span>{stats.callsOverTime.length > 0 ? format(new Date(stats.callsOverTime[stats.callsOverTime.length - 1].date), "MMM d") : ""}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Top Keywords</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {stats?.topKeywords.map((keyword, i) => (
                    <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/10 text-primary"
                      style={{ fontSize: `${Math.max(0.75, Math.min(1.25, 0.75 + (keyword.count / (stats.topKeywords[0]?.count || 1)) * 0.5))}rem` }}>
                      {keyword.word} <span className="ml-1 text-xs text-muted-foreground">({keyword.count})</span>
                    </span>
                  ))}
                  {(!stats?.topKeywords || stats.topKeywords.length === 0) && (
                    <p className="text-muted-foreground text-center py-8 w-full">No transcript data</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Tag Dialog */}
      <AlertDialog open={!!deleteTagId} onOpenChange={(open) => !open && setDeleteTagId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Outcome Tag</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This may affect existing call categorizations.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTag} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Rule Dialog */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={(open) => !open && setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SMS Rule</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This will stop automated messages from this rule.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRule} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
