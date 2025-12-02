"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Copy,
  Wand2,
  Check,
  AlertCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Link from "next/link";

interface CampaignData {
  id: string;
  name: string;
  webhook_token: string;
  payload_mapping: PayloadMapping | null;
}

interface PayloadMapping {
  transcript?: string;
  audio_url?: string;
  caller_phone?: string;
  call_duration?: string;
  timestamp?: string;
  recording_id?: string;
}

// Component to render JSON structure with clickable paths
function JsonExplorer({
  data,
  path = "",
  onPathClick,
}: {
  data: unknown;
  path?: string;
  onPathClick: (path: string, value: unknown) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (data === null || data === undefined) {
    return <span className="text-muted-foreground">null</span>;
  }

  if (typeof data !== "object") {
    const displayValue = typeof data === "string"
      ? data.length > 50 ? `"${data.substring(0, 50)}..."` : `"${data}"`
      : String(data);

    return (
      <button
        type="button"
        onClick={() => onPathClick(path, data)}
        className="text-blue-600 hover:underline text-left"
        title={`Click to use path: ${path}`}
      >
        {displayValue}
      </button>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-muted-foreground">[]</span>;
    }
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 hover:bg-muted px-1 rounded">
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="text-muted-foreground">[{data.length}]</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 border-l pl-2 space-y-1">
            {data.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-start gap-1">
                <span className="text-muted-foreground text-xs">{index}:</span>
                <JsonExplorer
                  data={item}
                  path={`${path}[${index}]`}
                  onPathClick={onPathClick}
                />
              </div>
            ))}
            {data.length > 5 && (
              <span className="text-muted-foreground text-xs">... and {data.length - 5} more</span>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) {
    return <span className="text-muted-foreground">{"{}"}</span>;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 hover:bg-muted px-1 rounded">
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="text-muted-foreground">{"{"}{entries.length}{"}"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 border-l pl-2 space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-start gap-1">
              <span className="text-green-600 font-medium text-sm">{key}:</span>
              <JsonExplorer
                data={value}
                path={path ? `${path}.${key}` : key}
                onPathClick={onPathClick}
              />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function WebhookConfigPage() {
  const params = useParams();
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [samplePayload, setSamplePayload] = useState("");
  const [parsedPayload, setParsedPayload] = useState<Record<string, unknown> | null>(null);
  const [mapping, setMapping] = useState<PayloadMapping>({});
  const [activeField, setActiveField] = useState<keyof PayloadMapping | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Parse payload when it changes
  useEffect(() => {
    if (samplePayload.trim()) {
      try {
        const parsed = JSON.parse(samplePayload);
        setParsedPayload(parsed);
      } catch {
        setParsedPayload(null);
      }
    } else {
      setParsedPayload(null);
    }
  }, [samplePayload]);

  // Handle path selection from explorer
  const handlePathClick = (path: string, _value: unknown) => {
    if (activeField) {
      setMapping({ ...mapping, [activeField]: path });
      toast({
        title: "Path selected",
        description: `Mapped "${path}" to ${activeField.replace(/_/g, " ")}`,
      });
    } else {
      navigator.clipboard.writeText(path);
      toast({
        title: "Path copied",
        description: `"${path}" copied to clipboard. Click a field to map directly.`,
      });
    }
  };

  const webhookUrl = campaign
    ? `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/webhooks/${campaign.webhook_token}`
    : "";

  useEffect(() => {
    async function fetchCampaign() {
      try {
        const response = await fetch(`/api/admin/campaigns/${params.id}`);
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const data = await response.json();
        setCampaign(data);
        if (data.payload_mapping) {
          setMapping(data.payload_mapping);
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
    }

    fetchCampaign();
  }, [params.id, toast]);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  const handleAnalyzePayload = async () => {
    if (!samplePayload.trim()) {
      toast({
        title: "Error",
        description: "Please paste a sample payload first",
        variant: "destructive",
      });
      return;
    }

    try {
      JSON.parse(samplePayload);
    } catch {
      toast({
        title: "Invalid JSON",
        description: "Please paste valid JSON payload",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch(
        `/api/admin/campaigns/${params.id}/analyze-payload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: samplePayload }),
        }
      );

      if (!response.ok) throw new Error("Failed to analyze payload");

      const data = await response.json();
      setMapping(data.mapping);

      toast({
        title: "Analysis complete",
        description: "AI has suggested field mappings. Review and save.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to analyze payload",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveMapping = async () => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/campaigns/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload_mapping: mapping }),
      });

      if (!response.ok) throw new Error("Failed to save mapping");

      toast({
        title: "Mapping saved",
        description: "Webhook configuration has been updated",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save mapping",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!samplePayload.trim()) {
      toast({
        title: "Error",
        description: "Please paste a sample payload to test",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: samplePayload,
      });

      if (response.ok) {
        toast({
          title: "Test successful",
          description: "Webhook received the payload successfully",
        });
      } else {
        toast({
          title: "Test failed",
          description: "Webhook returned an error",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to test webhook",
        variant: "destructive",
      });
    }
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
          <h1 className="text-3xl font-bold tracking-tight">
            Webhook Configuration
          </h1>
          <p className="text-muted-foreground">
            Configure how incoming webhook payloads are processed
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook URL</CardTitle>
              <CardDescription>
                Send POST requests to this URL from your voice AI platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-sm bg-muted p-3 rounded break-all">
                  {webhookUrl}
                </code>
                <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sample Payload</CardTitle>
              <CardDescription>
                Paste a sample JSON payload from your voice AI platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={`{
  "transcript": "Hello, this is John calling about...",
  "recording_url": "https://...",
  "from": "+1234567890",
  "duration": 120
}`}
                value={samplePayload}
                onChange={(e) => setSamplePayload(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <div className="flex space-x-2">
                <Button
                  onClick={handleAnalyzePayload}
                  disabled={isAnalyzing || !samplePayload}
                >
                  {isAnalyzing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Analyze with AI
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestWebhook}
                  disabled={!samplePayload}
                >
                  Test Webhook
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* JSON Explorer */}
          {parsedPayload && (
            <Card>
              <CardHeader>
                <CardTitle>Payload Explorer</CardTitle>
                <CardDescription>
                  {activeField ? (
                    <span className="text-primary">
                      Click a value below to map it to <strong>{activeField.replace(/_/g, " ")}</strong>
                    </span>
                  ) : (
                    "Click a field on the right, then click a value here to map it"
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="font-mono text-sm max-h-64 overflow-y-auto p-3 bg-muted rounded-md">
                  <JsonExplorer
                    data={parsedPayload}
                    onPathClick={handlePathClick}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Field Mapping</CardTitle>
            <CardDescription>
              Map JSON paths to the required fields. Use dot notation for nested
              fields (e.g., data.transcript)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsedPayload && activeField && (
              <div className="text-sm text-primary bg-primary/10 p-2 rounded">
                Click a value in the Payload Explorer to map it
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="transcript">Transcript *</Label>
                {mapping.transcript && (
                  <Badge variant="success" className="text-xs">
                    <Check className="mr-1 h-3 w-3" /> Mapped
                  </Badge>
                )}
              </div>
              <Input
                id="transcript"
                placeholder="transcript or data.transcript"
                value={mapping.transcript || ""}
                onChange={(e) =>
                  setMapping({ ...mapping, transcript: e.target.value })
                }
                onFocus={() => setActiveField("transcript")}
                className={activeField === "transcript" ? "ring-2 ring-primary" : ""}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="audio_url">Audio URL</Label>
                {mapping.audio_url && (
                  <Badge variant="success" className="text-xs">
                    <Check className="mr-1 h-3 w-3" /> Mapped
                  </Badge>
                )}
              </div>
              <Input
                id="audio_url"
                placeholder="recording_url or audio.url"
                value={mapping.audio_url || ""}
                onChange={(e) =>
                  setMapping({ ...mapping, audio_url: e.target.value })
                }
                onFocus={() => setActiveField("audio_url")}
                className={activeField === "audio_url" ? "ring-2 ring-primary" : ""}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="caller_phone">Caller Phone</Label>
                {mapping.caller_phone && (
                  <Badge variant="success" className="text-xs">
                    <Check className="mr-1 h-3 w-3" /> Mapped
                  </Badge>
                )}
              </div>
              <Input
                id="caller_phone"
                placeholder="from or caller.phone_number"
                value={mapping.caller_phone || ""}
                onChange={(e) =>
                  setMapping({ ...mapping, caller_phone: e.target.value })
                }
                onFocus={() => setActiveField("caller_phone")}
                className={activeField === "caller_phone" ? "ring-2 ring-primary" : ""}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="call_duration">Call Duration (seconds)</Label>
                {mapping.call_duration && (
                  <Badge variant="success" className="text-xs">
                    <Check className="mr-1 h-3 w-3" /> Mapped
                  </Badge>
                )}
              </div>
              <Input
                id="call_duration"
                placeholder="duration or call.duration_seconds"
                value={mapping.call_duration || ""}
                onChange={(e) =>
                  setMapping({ ...mapping, call_duration: e.target.value })
                }
                onFocus={() => setActiveField("call_duration")}
                className={activeField === "call_duration" ? "ring-2 ring-primary" : ""}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="timestamp">Timestamp</Label>
                {mapping.timestamp && (
                  <Badge variant="success" className="text-xs">
                    <Check className="mr-1 h-3 w-3" /> Mapped
                  </Badge>
                )}
              </div>
              <Input
                id="timestamp"
                placeholder="created_at or call.timestamp"
                value={mapping.timestamp || ""}
                onChange={(e) =>
                  setMapping({ ...mapping, timestamp: e.target.value })
                }
                onFocus={() => setActiveField("timestamp")}
                className={activeField === "timestamp" ? "ring-2 ring-primary" : ""}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="recording_id">External Call ID</Label>
                {mapping.recording_id && (
                  <Badge variant="success" className="text-xs">
                    <Check className="mr-1 h-3 w-3" /> Mapped
                  </Badge>
                )}
              </div>
              <Input
                id="recording_id"
                placeholder="id or call.id"
                value={mapping.recording_id || ""}
                onChange={(e) =>
                  setMapping({ ...mapping, recording_id: e.target.value })
                }
                onFocus={() => setActiveField("recording_id")}
                className={activeField === "recording_id" ? "ring-2 ring-primary" : ""}
              />
            </div>

            {!mapping.transcript && (
              <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  Transcript field is required for AI analysis
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSaveMapping}
              disabled={isSaving || !mapping.transcript}
              className="w-full"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Mapping
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
