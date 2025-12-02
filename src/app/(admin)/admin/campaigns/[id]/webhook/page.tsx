"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface CampaignData {
  id: string;
  name: string;
  webhook_token: string;
  payload_mapping: Record<string, string> | null;
}

interface WebhookLog {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  payload: Record<string, unknown>;
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

// Platform presets with sample payloads
const PLATFORM_PRESETS = {
  vapi: {
    name: "Vapi",
    description: "Voice AI platform for building voice agents",
    logo: "🤖",
    docsUrl: "https://docs.vapi.ai/webhooks",
    samplePayload: {
      type: "end-of-call-report",
      call: {
        id: "call_abc123",
        customer: {
          number: "+1234567890"
        },
        startedAt: "2024-01-15T10:30:00Z",
        endedAt: "2024-01-15T10:35:00Z"
      },
      artifact: {
        transcript: "AI: Hello, how can I help you today?\nCustomer: I'd like to schedule an appointment.\nAI: Of course! I can help you with that. What date works best for you?\nCustomer: How about next Tuesday?\nAI: Perfect, I have availability on Tuesday. Would 2pm work for you?\nCustomer: Yes, that works great.\nAI: Excellent! I've scheduled your appointment for Tuesday at 2pm. Is there anything else I can help you with?\nCustomer: No, that's all. Thank you!\nAI: You're welcome! Have a great day!",
        recordingUrl: "https://storage.vapi.ai/recordings/call_abc123.wav",
        duration: 300
      },
      endedReason: "customer-ended-call"
    }
  },
  autocalls: {
    name: "AutoCalls.ai",
    description: "AI-powered outbound calling platform",
    logo: "📞",
    docsUrl: "https://autocalls.ai/docs/webhooks",
    samplePayload: {
      call_id: "ac_call_xyz789",
      contact_phone: "+1987654321",
      call_duration_seconds: 180,
      call_status: "completed",
      formatted_transcript: "AI: Good morning! This is Sarah from ABC Company. Am I speaking with John?\nJohn: Yes, this is John.\nAI: Great! I'm calling about your recent inquiry regarding our services. Do you have a few minutes to chat?\nJohn: Sure, what do you have?\nAI: We have a special promotion this month...",
      recording_url: "https://storage.autocalls.ai/recordings/ac_call_xyz789.mp3",
      call_start_time: "2024-01-15T14:00:00Z"
    }
  },
  bland: {
    name: "Bland AI",
    description: "Enterprise AI phone calling",
    logo: "🎙️",
    docsUrl: "https://docs.bland.ai/webhooks",
    samplePayload: {
      call_id: "bland_123abc",
      to: "+1555123456",
      from: "+1555000000",
      call_length: 245,
      transcript: "Agent: Hello, this is the appointment reminder service. Is this Sarah?\nSarah: Yes, speaking.\nAgent: I'm calling to remind you about your appointment tomorrow at 3pm. Will you still be able to make it?\nSarah: Oh yes, I'll be there. Thanks for the reminder!\nAgent: Wonderful! See you tomorrow at 3pm. Have a great day!",
      recording_url: "https://api.bland.ai/recordings/bland_123abc",
      completed: true,
      status: "completed"
    }
  },
  custom: {
    name: "Custom Platform",
    description: "Any platform that sends JSON webhooks",
    logo: "⚙️",
    docsUrl: null,
    samplePayload: {
      transcript: "Your call transcript goes here...",
      phone: "+1234567890",
      duration: 120,
      recording_url: "https://your-platform.com/recordings/123",
      call_id: "your_call_id_123"
    }
  }
};

type PlatformKey = keyof typeof PLATFORM_PRESETS;

// Field detection helper (mirrors webhook route logic)
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
    "customer.number", "contact_phone", "lead_phone", "to"
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
      {detected ? (
        <CheckCircle2 className="h-4 w-4 ml-auto" />
      ) : (
        <XCircle className="h-4 w-4 ml-auto opacity-50" />
      )}
    </div>
  );
}

export default function WebhookConfigPage() {
  const params = useParams();
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("setup");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>("vapi");
  const [testPayload, setTestPayload] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [previewAnalysis, setPreviewAnalysis] = useState<ReturnType<typeof analyzePayload> | null>(null);
  const { toast } = useToast();

  const webhookUrl = campaign
    ? `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/api/webhooks/${campaign.webhook_token}`
    : "";

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/campaigns/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch campaign");
      const data = await response.json();
      setCampaign(data);

      const logsResponse = await fetch(`/api/admin/campaigns/${params.id}/webhook-logs`);
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setLogs(logsData.slice(0, 10));
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
  }, [params.id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update test payload when platform changes
  useEffect(() => {
    const preset = PLATFORM_PRESETS[selectedPlatform];
    setTestPayload(JSON.stringify(preset.samplePayload, null, 2));
    try {
      setPreviewAnalysis(analyzePayload(preset.samplePayload));
    } catch {
      setPreviewAnalysis(null);
    }
  }, [selectedPlatform]);

  // Update preview when test payload changes
  useEffect(() => {
    try {
      const parsed = JSON.parse(testPayload);
      setPreviewAnalysis(analyzePayload(parsed));
    } catch {
      setPreviewAnalysis(null);
    }
  }, [testPayload]);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Webhook URL copied to clipboard",
    });
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      setTestResult({
        success: response.ok,
        message: result.message || (response.ok ? "Webhook processed successfully!" : result.error || "Unknown error"),
        type: result.type,
        detected: result.detected,
        callId: result.callId,
      });

      // Refresh logs
      setTimeout(fetchData, 500);

      toast({
        title: response.ok ? "Test Successful!" : "Test Failed",
        description: result.message || result.error,
        variant: response.ok ? "default" : "destructive",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON payload";
      setTestResult({
        success: false,
        message,
      });
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getConnectionStatus = () => {
    if (logs.length === 0) return { status: "unknown", message: "No webhooks received yet" };

    const recentLog = logs[0];
    const recentTime = new Date(recentLog.created_at);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (recentLog.status === "success" && recentTime > hourAgo) {
      return { status: "healthy", message: "Connected and receiving data" };
    } else if (recentLog.status === "failed") {
      return { status: "error", message: "Last webhook failed" };
    } else {
      return { status: "idle", message: "No recent activity" };
    }
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
          <Link href={`/admin/campaigns/${params.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhook Setup</h1>
            <p className="text-muted-foreground">
              Connect {campaign?.name} to receive call data
            </p>
          </div>
        </div>

        {/* Connection Status Badge */}
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

      {/* Webhook URL Card - Always visible */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Your Webhook URL
          </CardTitle>
          <CardDescription>
            Copy this URL and paste it in your voice AI platform&apos;s webhook settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-background p-4 rounded-lg border font-mono break-all">
              {webhookUrl}
            </code>
            <Button
              variant="default"
              size="lg"
              onClick={handleCopyWebhook}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy URL
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Quick Setup
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Test Webhook
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Recent Logs
          </TabsTrigger>
        </TabsList>

        {/* Quick Setup Tab */}
        <TabsContent value="setup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Choose Your Platform</CardTitle>
              <CardDescription>
                Select your voice AI platform to see platform-specific setup instructions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.entries(PLATFORM_PRESETS) as [PlatformKey, typeof PLATFORM_PRESETS[PlatformKey]][]).map(([key, platform]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPlatform(key)}
                    className={`p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50 ${
                      selectedPlatform === key
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="text-2xl mb-2">{platform.logo}</div>
                    <div className="font-medium">{platform.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {platform.description}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Platform-specific instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl">{PLATFORM_PRESETS[selectedPlatform].logo}</span>
                Setup Instructions for {PLATFORM_PRESETS[selectedPlatform].name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">1</span>
                  <div>
                    <p className="font-medium">Copy the webhook URL above</p>
                    <p className="text-sm text-muted-foreground">Click the &quot;Copy URL&quot; button to copy it to your clipboard</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">2</span>
                  <div>
                    <p className="font-medium">
                      {selectedPlatform === "vapi" && "Go to your Vapi dashboard → Assistants → Select your assistant → Advanced → Server URL"}
                      {selectedPlatform === "autocalls" && "Go to AutoCalls.ai → Settings → Webhooks → Add new webhook"}
                      {selectedPlatform === "bland" && "Go to Bland AI → Settings → Webhooks → Add endpoint"}
                      {selectedPlatform === "custom" && "Go to your platform's webhook settings"}
                    </p>
                    <p className="text-sm text-muted-foreground">Navigate to the webhook configuration section</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">3</span>
                  <div>
                    <p className="font-medium">Paste the webhook URL and save</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedPlatform === "vapi" && "Select 'end-of-call-report' event type for best results"}
                      {selectedPlatform === "autocalls" && "Enable 'Call Completed' webhook event"}
                      {selectedPlatform === "bland" && "Enable 'Call Ended' webhook trigger"}
                      {selectedPlatform === "custom" && "Configure to send POST requests with call data"}
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">4</span>
                  <div>
                    <p className="font-medium">Test the connection</p>
                    <p className="text-sm text-muted-foreground">Use the &quot;Test Webhook&quot; tab to verify everything is working</p>
                  </div>
                </li>
              </ol>

              {PLATFORM_PRESETS[selectedPlatform].docsUrl && (
                <div className="pt-4 border-t">
                  <a
                    href={PLATFORM_PRESETS[selectedPlatform].docsUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View {PLATFORM_PRESETS[selectedPlatform].name} webhook documentation
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto-detection info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Smart Auto-Detection
              </CardTitle>
              <CardDescription>
                We automatically detect and extract these fields from any webhook payload
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Transcript</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    transcript, transcription, text, content, formatted_transcript, artifact.transcript
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Phone Number</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    phone, from, caller, contact_phone, customer.number
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Recording URL</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    recording_url, audio_url, audio, artifact.recordingUrl
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Timer className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Duration</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    duration, call_duration, call_length, artifact.duration
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Call ID</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    id, call_id, uuid, external_id
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Timestamp</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    timestamp, created_at, start_time, call_start_time
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Webhook Tab */}
        <TabsContent value="test" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Payload Editor */}
            <Card>
              <CardHeader>
                <CardTitle>Test Payload</CardTitle>
                <CardDescription>
                  Edit the sample payload or paste your own to test
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(PLATFORM_PRESETS) as [PlatformKey, typeof PLATFORM_PRESETS[PlatformKey]][]).map(([key, platform]) => (
                    <Button
                      key={key}
                      variant={selectedPlatform === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedPlatform(key)}
                    >
                      {platform.logo} {platform.name}
                    </Button>
                  ))}
                </div>

                <Textarea
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  className="font-mono text-xs min-h-[300px]"
                  placeholder="Enter JSON payload..."
                />

                <Button
                  onClick={handleTestWebhook}
                  disabled={isTesting || !testPayload}
                  className="w-full"
                  size="lg"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending Test...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Send Test Webhook
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Preview & Results */}
            <div className="space-y-6">
              {/* Live Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Field Detection Preview</CardTitle>
                  <CardDescription>
                    See what fields will be detected from your payload
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {previewAnalysis ? (
                    <div className="grid gap-3">
                      <DetectionBadge
                        detected={previewAnalysis.hasTranscript}
                        label="Transcript"
                        icon={FileText}
                      />
                      <DetectionBadge
                        detected={previewAnalysis.hasPhone}
                        label="Phone Number"
                        icon={Phone}
                      />
                      <DetectionBadge
                        detected={previewAnalysis.hasAudioUrl}
                        label="Recording URL"
                        icon={Music}
                      />
                      <DetectionBadge
                        detected={previewAnalysis.hasDuration}
                        label="Duration"
                        icon={Timer}
                      />
                      <DetectionBadge
                        detected={previewAnalysis.hasCallId}
                        label="Call ID"
                        icon={Hash}
                      />

                      {!previewAnalysis.hasTranscript && (
                        <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800">
                          <div className="flex gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-yellow-700 dark:text-yellow-400">
                              <p className="font-medium">No transcript detected</p>
                              <p className="text-xs mt-1">Without a transcript, this will be treated as a ping/connection test rather than a call record.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileJson className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Invalid JSON - check your payload</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Test Result */}
              {testResult && (
                <Card className={testResult.success ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      Test Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`p-3 rounded-lg ${
                      testResult.success ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"
                    }`}>
                      <p className={`text-sm font-medium ${
                        testResult.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                      }`}>
                        {testResult.message}
                      </p>
                      {testResult.type && (
                        <Badge variant="secondary" className="mt-2">
                          Type: {testResult.type}
                        </Badge>
                      )}
                      {testResult.callId && (
                        <p className="text-xs mt-2 text-muted-foreground">
                          Call ID: {testResult.callId}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Webhook Logs</CardTitle>
                  <CardDescription>
                    Last 10 webhook requests received for this campaign
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No webhooks received yet</p>
                  <p className="text-sm mt-1">
                    Send a test from the &quot;Test Webhook&quot; tab or make a call from your voice AI platform
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => {
                    const analysis = analyzePayload(log.payload);
                    const isPing = log.error_message === "Ping received (no transcript)";

                    return (
                      <div
                        key={log.id}
                        className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {log.status === "success" ? (
                              isPing ? (
                                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                                  <Zap className="h-4 w-4 text-blue-500" />
                                </div>
                              ) : (
                                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </div>
                              )
                            ) : (
                              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                                <XCircle className="h-4 w-4 text-red-500" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    log.status === "success"
                                      ? isPing ? "secondary" : "success"
                                      : "destructive"
                                  }
                                >
                                  {isPing ? "Ping" : log.status === "success" ? "Call Received" : "Failed"}
                                </Badge>
                                {analysis.hasTranscript && (
                                  <span className="text-xs text-muted-foreground">
                                    with transcript
                                  </span>
                                )}
                              </div>
                              {log.error_message && !isPing && (
                                <p className="text-xs text-red-500 mt-1">
                                  {log.error_message}
                                </p>
                              )}
                              <div className="flex gap-2 mt-2">
                                {analysis.hasTranscript && <FileText className="h-3 w-3 text-green-500" />}
                                {analysis.hasPhone && <Phone className="h-3 w-3 text-green-500" />}
                                {analysis.hasAudioUrl && <Music className="h-3 w-3 text-green-500" />}
                                {analysis.hasDuration && <Timer className="h-3 w-3 text-green-500" />}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(
                              new Date(log.created_at.endsWith("Z") ? log.created_at : log.created_at + "Z"),
                              { addSuffix: true }
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <Link href="/admin/webhook-logs">
                  <Button variant="outline" className="w-full">
                    View All Webhook Logs
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
