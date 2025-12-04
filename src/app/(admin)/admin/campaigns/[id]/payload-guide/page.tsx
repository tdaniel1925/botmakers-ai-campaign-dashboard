"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  CheckCircle2,
  Zap,
  Sparkles,
  FileText,
  Phone,
  Music,
  Timer,
  Hash,
  AlertCircle,
  ExternalLink,
  Settings2,
  RefreshCw,
  Globe,
  Code2,
  Brain,
  Database,
  MessageSquare,
  Tag,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CampaignData {
  id: string;
  name: string;
  webhook_token: string;
  payload_mapping: Record<string, string | null> | null;
}

const PLATFORM_EXAMPLES = {
  vapi: {
    name: "Vapi",
    logo: "🤖",
    webhookDocs: "https://docs.vapi.ai/webhooks",
    setupSteps: [
      "Go to your Vapi dashboard",
      "Navigate to Settings → Webhooks",
      "Add a new webhook endpoint with the URL below",
      "Select 'end-of-call-report' as the event type",
      "Save and test with a call"
    ],
    samplePayload: {
      type: "end-of-call-report",
      call: {
        id: "call_abc123xyz",
        customer: {
          number: "+1234567890"
        },
        startedAt: "2024-01-15T10:30:00Z",
        endedAt: "2024-01-15T10:35:00Z",
        endedReason: "customer-ended-call"
      },
      artifact: {
        transcript: "AI: Hello! How can I help you today?\nCustomer: Hi, I'm calling about my order.\nAI: I'd be happy to help with your order. Can you provide your order number?\nCustomer: Yes, it's 12345.\nAI: Thank you! I found your order...",
        recordingUrl: "https://storage.vapi.ai/recordings/call_abc123xyz.wav"
      },
      analysis: {
        summary: "Customer inquired about order status. Agent provided tracking information.",
        successEvaluation: true
      }
    }
  },
  autocalls: {
    name: "AutoCalls.ai",
    logo: "📞",
    webhookDocs: "https://autocalls.ai/docs/webhooks",
    setupSteps: [
      "Log into AutoCalls.ai dashboard",
      "Go to Integrations → Webhooks",
      "Create a new webhook with the endpoint URL",
      "Enable 'Call Completed' events",
      "Test with a sample call"
    ],
    samplePayload: {
      event: "call.completed",
      call_id: "ac_call_xyz789",
      contact_phone: "+1987654321",
      call_duration_seconds: 180,
      formatted_transcript: "AI: Good morning! This is a follow-up call regarding your inquiry.\nJohn: Yes, I was expecting this call.\nAI: Great! I wanted to confirm your appointment for tomorrow at 2 PM.\nJohn: That works for me.",
      recording_url: "https://storage.autocalls.ai/recordings/ac_call_xyz789.mp3",
      call_status: "completed",
      created_at: "2024-01-15T14:20:00Z"
    }
  },
  bland: {
    name: "Bland AI",
    logo: "🎙️",
    webhookDocs: "https://docs.bland.ai/webhooks",
    setupSteps: [
      "Access your Bland AI account",
      "Navigate to Developer Settings",
      "Add a webhook URL under 'Call Events'",
      "Select 'call.ended' event",
      "Verify with a test call"
    ],
    samplePayload: {
      event_type: "call.ended",
      call_id: "bland_123abc",
      to: "+1555123456",
      from: "+1555987654",
      call_length: 245,
      transcript: "Agent: Hello! Thank you for your interest in our services.\nSarah: Hi, I saw your ad and wanted to learn more.\nAgent: Absolutely! Let me tell you about our offerings...",
      recording_url: "https://api.bland.ai/recordings/bland_123abc",
      status: "completed",
      ended_reason: "user_hangup"
    }
  },
  custom: {
    name: "Custom Platform",
    logo: "⚙️",
    webhookDocs: null,
    setupSteps: [
      "Find your platform's webhook settings",
      "Add the webhook URL as an endpoint",
      "Configure it to send call completion events",
      "Ensure the payload includes transcript and call data",
      "Test with a sample payload"
    ],
    samplePayload: {
      call_id: "custom_12345",
      phone_number: "+1234567890",
      duration_seconds: 120,
      transcript: "Your call transcript goes here...",
      audio_url: "https://your-platform.com/recordings/12345.mp3",
      status: "completed",
      timestamp: "2024-01-15T09:00:00Z"
    }
  }
};

type PlatformKey = keyof typeof PLATFORM_EXAMPLES;

export default function PayloadGuidePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>("vapi");
  const [expandedSection, setExpandedSection] = useState<string | null>("how-it-works");

  const webhookUrl = campaign
    ? `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")}/api/webhooks/${campaign.webhook_token}`
    : "";

  const fetchCampaign = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/campaigns/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch campaign");
      const data = await response.json();
      setCampaign(data);
    } catch {
      toast({ title: "Error", description: "Failed to load campaign", variant: "destructive" });
      router.push("/admin/campaigns");
    } finally {
      setIsLoading(false);
    }
  }, [params.id, router, toast]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const platform = PLATFORM_EXAMPLES[selectedPlatform];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/campaigns/${params.id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Campaign
            </Link>
          </Button>
        </div>
        <Badge variant="secondary" className="text-sm">
          {campaign?.name}
        </Badge>
      </div>

      {/* Hero Section */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">Webhook Setup Guide</h1>
              <p className="text-muted-foreground mb-4">
                Connect your AI calling platform to automatically capture and analyze every call.
                Our smart system uses AI to understand any payload format - no configuration required.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI-Powered
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Globe className="h-3 w-3 mr-1" />
                  Universal Compatibility
                </Badge>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  <Settings2 className="h-3 w-3 mr-1" />
                  Zero Config
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL - Most Important */}
      <Card className="border-2 border-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            Your Webhook URL
          </CardTitle>
          <CardDescription>
            Copy this URL and paste it into your AI calling platform's webhook settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <code className="flex-1 p-3 bg-muted rounded-lg text-sm font-mono break-all">
              {webhookUrl}
            </code>
            <Button onClick={() => handleCopy(webhookUrl, "Webhook URL")} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This URL is unique to this campaign. Each campaign has its own webhook endpoint.
          </p>
        </CardContent>
      </Card>

      {/* How It Works - Collapsible */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => toggleSection("how-it-works")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg">How It Works</CardTitle>
            </div>
            {expandedSection === "how-it-works" ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {expandedSection === "how-it-works" && (
          <CardContent className="pt-0">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Step 1 */}
              <div className="relative p-4 rounded-lg border bg-card">
                <div className="absolute -top-3 left-4 px-2 bg-background">
                  <Badge variant="secondary">Step 1</Badge>
                </div>
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-950">
                      <Globe className="h-4 w-4 text-blue-600" />
                    </div>
                    <h4 className="font-medium">Webhook Receives Data</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When a call ends, your AI platform sends the call data (transcript, duration, etc.) to your webhook URL.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative p-4 rounded-lg border bg-card">
                <div className="absolute -top-3 left-4 px-2 bg-background">
                  <Badge variant="secondary">Step 2</Badge>
                </div>
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-950">
                      <Sparkles className="h-4 w-4 text-yellow-600" />
                    </div>
                    <h4 className="font-medium">AI Extracts Fields</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Our AI automatically identifies and extracts the transcript, phone number, duration, and other key fields from any JSON format.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative p-4 rounded-lg border bg-card">
                <div className="absolute -top-3 left-4 px-2 bg-background">
                  <Badge variant="secondary">Step 3</Badge>
                </div>
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-950">
                      <Database className="h-4 w-4 text-green-600" />
                    </div>
                    <h4 className="font-medium">Call is Processed</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The call is saved, AI analyzes the transcript for sentiment and summary, and it appears in your dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* What Gets Extracted */}
            <div className="mt-6 p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Fields Automatically Detected
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Call Transcript</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-primary" />
                  <span>Phone Number</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Music className="h-4 w-4 text-primary" />
                  <span>Recording URL</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Timer className="h-4 w-4 text-primary" />
                  <span>Call Duration</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-primary" />
                  <span>External Call ID</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Timestamp</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4 text-primary" />
                  <span>Call Status</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span>AI Summary</span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Platform-Specific Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Code2 className="h-5 w-5" />
            Platform Setup Instructions
          </CardTitle>
          <CardDescription>
            Select your AI calling platform for specific setup instructions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Platform Selector */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.entries(PLATFORM_EXAMPLES) as [PlatformKey, typeof PLATFORM_EXAMPLES[PlatformKey]][]).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setSelectedPlatform(key)}
                className={`p-3 rounded-lg border-2 text-left transition-all hover:border-primary/50 ${
                  selectedPlatform === key ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="text-2xl mb-1">{p.logo}</div>
                <div className="font-medium text-sm">{p.name}</div>
              </button>
            ))}
          </div>

          {/* Setup Steps */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium flex items-center gap-2">
                {platform.logo} {platform.name} Setup
              </h4>
              {platform.webhookDocs && (
                <a
                  href={platform.webhookDocs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View Docs <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <ol className="space-y-3">
              {platform.setupSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Sample Payload */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm">Sample Payload from {platform.name}</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(JSON.stringify(platform.samplePayload, null, 2), "Sample payload")}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
            <pre className="text-xs font-mono overflow-y-auto overflow-x-hidden p-3 bg-background rounded border max-h-[300px] whitespace-pre-wrap break-all">
              {JSON.stringify(platform.samplePayload, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* What Happens After */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => toggleSection("after-webhook")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">What Happens After a Webhook</CardTitle>
            </div>
            {expandedSection === "after-webhook" ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {expandedSection === "after-webhook" && (
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <Database className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Call Record Created</h4>
                  <p className="text-sm text-muted-foreground">
                    A new call record is saved with the transcript, phone number, duration, and recording URL.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
                <Brain className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">AI Analysis Begins</h4>
                  <p className="text-sm text-muted-foreground">
                    OpenAI analyzes the transcript to generate a summary, determine sentiment (positive/negative/neutral), and assign outcome tags.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                <MessageSquare className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">SMS Rules Checked</h4>
                  <p className="text-sm text-muted-foreground">
                    If you have SMS rules configured, the system checks if any conditions are met and sends automated follow-up messages.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Dashboard Updated</h4>
                  <p className="text-sm text-muted-foreground">
                    The call appears in your Calls tab and analytics are updated in real-time.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Custom Field Mapping */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => toggleSection("custom-mapping")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-lg">Custom Field Mapping (Optional)</CardTitle>
            </div>
            {expandedSection === "custom-mapping" ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {expandedSection === "custom-mapping" && (
          <CardContent className="pt-0">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                By default, AI automatically detects where each field is in your payload. However, if you want to override the AI's detection or use a specific field path, you can configure custom mappings.
              </p>

              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-3">How to Set Custom Mappings</h4>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-primary">1.</span>
                    Go to the Webhook tab on your campaign page
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-primary">2.</span>
                    Paste a sample payload in the test area
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-primary">3.</span>
                    Click "Analyze with AI" to see suggested mappings
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-primary">4.</span>
                    Use the dropdowns to adjust any field paths
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-primary">5.</span>
                    Click "Save Mappings" to use your custom configuration
                  </li>
                </ol>
              </div>

              {campaign?.payload_mapping && Object.values(campaign.payload_mapping).some(v => v !== null) ? (
                <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm text-green-700 dark:text-green-400">Custom Mappings Active</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This campaign is using saved field mappings. The AI will use your configured paths instead of auto-detection.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm text-blue-700 dark:text-blue-400">AI Auto-Detection Active</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This campaign is using AI auto-detection. Fields will be automatically extracted from any payload format.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => toggleSection("troubleshooting")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-lg">Troubleshooting</CardTitle>
            </div>
            {expandedSection === "troubleshooting" ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {expandedSection === "troubleshooting" && (
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="p-4 rounded-lg border">
                <h4 className="font-medium text-sm mb-2">Webhook not receiving data?</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Verify the webhook URL is correctly copied (including the full path)</li>
                  <li>Check that your AI platform is configured to send "call completed" or "end-of-call" events</li>
                  <li>Ensure the webhook is enabled/active in your platform settings</li>
                  <li>Check the Recent Webhook Logs on the Webhook tab for incoming requests</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium text-sm mb-2">Fields not being extracted correctly?</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Use the "Analyze with AI" feature to see what the AI detects</li>
                  <li>Set up custom field mappings if the AI isn't finding the right paths</li>
                  <li>Ensure your payload contains the data (transcript, phone, etc.)</li>
                  <li>Check that field values aren't empty or null in the payload</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium text-sm mb-2">Call showing but no AI analysis?</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>AI analysis requires a transcript - ensure one was included</li>
                  <li>Check that your OpenAI API key is configured in Settings</li>
                  <li>The call may still be processing - wait a few moments and refresh</li>
                </ul>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold mb-1">Ready to test?</h3>
              <p className="text-sm text-muted-foreground">
                Go to the Webhook tab to send a test payload and verify everything is working.
              </p>
            </div>
            <Button asChild>
              <Link href={`/admin/campaigns/${params.id}?tab=webhook`}>
                Go to Webhook Tab
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
