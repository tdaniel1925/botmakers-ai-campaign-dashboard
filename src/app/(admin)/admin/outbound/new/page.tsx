"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Building2,
  FileText,
  Bot,
  Phone,
  Calendar,
  MessageSquare,
  DollarSign,
  Users,
  Play,
  Pause,
  Volume2,
  Settings,
  Upload,
  Plus,
  Trash2,
  Mic,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Client {
  id: string;
  name: string;
  company_name: string | null;
}

interface WizardData {
  // Step 1: Client Selection
  client_id: string;
  // Step 2: Campaign Details
  name: string;
  description: string;
  // Step 3: AI Agent Configuration
  system_prompt: string;
  first_message: string;
  voice_id: string;
  voice_provider: string;
  // Step 4: Structured Data Collection
  structured_data_schema: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  // Step 5: End Call Conditions
  end_call_conditions: string[];
  max_duration_seconds: number;
  silence_timeout_seconds: number;
  // Step 6: Phone Number
  phone_number_option: "provision" | "existing" | "manual";
  area_code: string;
  existing_phone_id: string;
  manual_phone_number: string;
  // Step 7: Schedule
  schedule_days: number[];
  schedule_start_time: string;
  schedule_end_time: string;
  schedule_timezone: string;
  // Step 8: SMS Templates
  sms_templates: Array<{
    name: string;
    trigger_type: string;
    template_body: string;
    link_url: string;
  }>;
  // Step 9: Contact List (handled separately via upload)
  // Step 10: Retry Settings
  retry_enabled: boolean;
  retry_attempts: number;
  retry_delay_minutes: number;
  max_concurrent_calls: number;
  // Step 11: Billing
  rate_per_minute: string;
  billing_threshold: string;
  // Step 12: Review & Launch
  is_test_mode: boolean;
  test_call_limit: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

// Vapi native voices (optimized for conversational AI)
// Preview URLs from Vapi's voice samples
const VAPI_VOICES = [
  { id: "Hana", name: "Hana", description: "American Female, 22", provider: "vapi", previewUrl: "https://static.vapi.ai/voice-previews/Hana.mp3" },
  { id: "Harry", name: "Harry", description: "American Male, 24", provider: "vapi", previewUrl: "https://static.vapi.ai/voice-previews/Harry.mp3" },
  { id: "Paige", name: "Paige", description: "American Female, 26", provider: "vapi", previewUrl: "https://static.vapi.ai/voice-previews/Paige.mp3" },
  { id: "Cole", name: "Cole", description: "American Male, 22", provider: "vapi", previewUrl: "https://static.vapi.ai/voice-previews/Cole.mp3" },
  { id: "Savannah", name: "Savannah", description: "Southern American Female, 25", provider: "vapi", previewUrl: "https://static.vapi.ai/voice-previews/Savannah.mp3" },
  { id: "Spencer", name: "Spencer", description: "American Female, 26", provider: "vapi", previewUrl: "https://static.vapi.ai/voice-previews/Spencer.mp3" },
  { id: "Lily", name: "Lily", description: "Asian American Female, 25", provider: "vapi", previewUrl: "https://static.vapi.ai/voice-previews/Lily.mp3" },
  { id: "Elliot", name: "Elliot", description: "Canadian Male, 25", provider: "vapi", previewUrl: "https://static.vapi.ai/voice-previews/Elliot.mp3" },
  { id: "Rohan", name: "Rohan", description: "Indian American Male, 24", provider: "vapi", previewUrl: "https://static.vapi.ai/voice-previews/Rohan.mp3" },
  { id: "Neha", name: "Neha", description: "Indian American Female, 30", provider: "vapi", previewUrl: "https://static.vapi.ai/voice-previews/Neha.mp3" },
];

// ElevenLabs preset voices (high quality, natural sounding)
// Preview URLs from ElevenLabs voice library
const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Professional Female", provider: "11labs", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-5c96-470d-8571-e324afc1f5b2.mp3" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Professional Male", provider: "11labs", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/TxGEqnHWrfWFTfGW9XjX/c6c80dcd-5fe5-4a4c-8e26-a8a0748e297b.mp3" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep Male", provider: "11labs", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/e0b45450-78db-49b9-aaa4-d5358a6871bd.mp3" },
  { id: "LcfcDJNUP1GQjkzn1xUU", name: "Emily", description: "Friendly Female", provider: "11labs", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/LcfcDJNUP1GQjkzn1xUU/e4b994b7-9713-4238-84f3-add8fccb4c6f.mp3" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Conversational Male", provider: "11labs", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Soft Female", provider: "11labs", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2571fcf5d1.mp3" },
  { id: "GBv7mTt0atIp3Br8iCZE", name: "Thomas", description: "Calm Male", provider: "11labs", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/GBv7mTt0atIp3Br8iCZE/f39e5dd5-c8ab-4029-a3c3-73d6183c2bf7.mp3" },
];

// Combined voices grouped by provider
const VOICE_PROVIDERS = [
  { id: "vapi", name: "Vapi Voices", description: "Optimized for conversational AI" },
  { id: "11labs", name: "ElevenLabs", description: "High quality, natural sounding" },
];

const VOICES = [...VAPI_VOICES, ...ELEVENLABS_VOICES];

const DATA_TYPES = ["string", "number", "boolean"];

const SMS_TRIGGER_TYPES = [
  { value: "call_completed", label: "After Call Completed" },
  { value: "positive_outcome", label: "Positive Outcome" },
  { value: "negative_outcome", label: "Negative Outcome" },
  { value: "no_answer", label: "No Answer" },
  { value: "voicemail", label: "Left Voicemail" },
];

const STEPS = [
  { id: 1, title: "Client", icon: Building2 },
  { id: 2, title: "Details", icon: FileText },
  { id: 3, title: "AI Agent", icon: Bot },
  { id: 4, title: "Data Schema", icon: Settings },
  { id: 5, title: "Call Settings", icon: Phone },
  { id: 6, title: "Phone Number", icon: Phone },
  { id: 7, title: "Schedule", icon: Calendar },
  { id: 8, title: "SMS", icon: MessageSquare },
  { id: 9, title: "Contacts", icon: Users },
  { id: 10, title: "Retry", icon: Settings },
  { id: 11, title: "Billing", icon: DollarSign },
  { id: 12, title: "Review", icon: Play },
];

const initialData: WizardData = {
  client_id: "",
  name: "",
  description: "",
  system_prompt: "",
  first_message: "Hello, this is an AI assistant calling on behalf of {{company_name}}. How are you today?",
  voice_id: "Hana",
  voice_provider: "vapi",
  structured_data_schema: [],
  end_call_conditions: ["goodbye", "bye", "thank you for your time"],
  max_duration_seconds: 300,
  silence_timeout_seconds: 30,
  phone_number_option: "provision",
  area_code: "",
  existing_phone_id: "",
  manual_phone_number: "",
  schedule_days: [1, 2, 3, 4, 5], // Mon-Fri
  schedule_start_time: "09:00",
  schedule_end_time: "17:00",
  schedule_timezone: "America/New_York",
  sms_templates: [],
  retry_enabled: true,
  retry_attempts: 2,
  retry_delay_minutes: 60,
  max_concurrent_calls: 5,
  rate_per_minute: "0.15",
  billing_threshold: "100.00",
  is_test_mode: true,
  test_call_limit: 10,
};

export default function NewOutboundCampaignPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // AI Prompt Generator state
  const [showAIPromptDialog, setShowAIPromptDialog] = useState(false);
  const [aiPromptDescription, setAiPromptDescription] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  // AI Prompt Generator handler
  const handleGeneratePrompt = async () => {
    if (!aiPromptDescription.trim()) {
      toast({
        title: "Description required",
        description: "Please describe what you want the AI agent to do",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const selectedClient = clients.find(c => c.id === data.client_id);

      const response = await fetch("/api/admin/ai/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: aiPromptDescription,
          campaignType: "outbound calling",
          companyName: selectedClient?.company_name || selectedClient?.name || "",
          targetAudience: "",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate prompt");
      }

      const { prompt } = await response.json();
      updateData("system_prompt", prompt);
      setShowAIPromptDialog(false);
      setAiPromptDescription("");

      toast({
        title: "Prompt generated",
        description: "AI has created a system prompt. Feel free to edit it.",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate prompt",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Voice preview handler
  const handleVoicePreview = (voiceId: string, previewUrl: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If this voice is already playing, stop it
    if (playingVoiceId === voiceId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Create new audio and play
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    setPlayingVoiceId(voiceId);

    audio.play().catch((err) => {
      console.error("Failed to play voice preview:", err);
      setPlayingVoiceId(null);
    });

    audio.onended = () => {
      setPlayingVoiceId(null);
    };

    audio.onerror = () => {
      setPlayingVoiceId(null);
      toast({
        title: "Preview unavailable",
        description: "Could not load voice preview",
        variant: "destructive",
      });
    };
  };

  useEffect(() => {
    async function fetchClients() {
      try {
        const response = await fetch("/api/admin/clients");
        if (response.ok) {
          const clientsData = await response.json();
          setClients(clientsData.filter((c: Client & { is_active?: boolean }) => c.is_active !== false));
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to load clients",
          variant: "destructive",
        });
      } finally {
        setIsLoadingClients(false);
      }
    }
    fetchClients();
  }, [toast]);

  const updateData = (field: keyof WizardData, value: unknown) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!data.client_id;
      case 2:
        return !!data.name;
      case 3:
        return !!data.system_prompt;
      case 5:
        return data.max_duration_seconds > 0;
      case 6:
        if (data.phone_number_option === "provision") return true;
        if (data.phone_number_option === "existing") return !!data.existing_phone_id;
        if (data.phone_number_option === "manual") return !!data.manual_phone_number;
        return false;
      case 7:
        return data.schedule_days.length > 0 && !!data.schedule_start_time && !!data.schedule_end_time;
      case 11:
        return parseFloat(data.rate_per_minute) > 0;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!canProceed()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Create campaign after step 2
    if (currentStep === 2 && !createdCampaignId) {
      setIsSubmitting(true);
      try {
        const response = await fetch("/api/admin/outbound-campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: data.client_id,
            name: data.name,
            description: data.description || null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create campaign");
        }

        const campaign = await response.json();
        setCreatedCampaignId(campaign.id);
        toast({
          title: "Campaign Created",
          description: "Draft campaign saved. Continue configuring...",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create campaign",
          variant: "destructive",
        });
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    if (currentStep < 12) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSaveDraft = async () => {
    if (!createdCampaignId) return;
    setIsSubmitting(true);
    try {
      await saveCampaignData();
      toast({
        title: "Draft Saved",
        description: "Campaign configuration saved successfully",
      });
      router.push(`/admin/outbound/${createdCampaignId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveCampaignData = async () => {
    if (!createdCampaignId) return;

    const agentConfig = {
      system_prompt: data.system_prompt,
      first_message: data.first_message,
      voice_id: data.voice_id,
      voice_provider: data.voice_provider,
      end_call_conditions: data.end_call_conditions,
      max_duration_seconds: data.max_duration_seconds,
      silence_timeout_seconds: data.silence_timeout_seconds,
    };

    const response = await fetch(`/api/admin/outbound-campaigns/${createdCampaignId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description || null,
        agent_config: agentConfig,
        structured_data_schema: data.structured_data_schema,
        retry_enabled: data.retry_enabled,
        retry_attempts: data.retry_attempts,
        retry_delay_minutes: data.retry_delay_minutes,
        max_concurrent_calls: data.max_concurrent_calls,
        rate_per_minute: parseFloat(data.rate_per_minute),
        billing_threshold: parseFloat(data.billing_threshold),
        is_test_mode: data.is_test_mode,
        test_call_limit: data.test_call_limit,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to save campaign");
    }
  };

  const handleLaunch = async () => {
    if (!createdCampaignId) return;
    setIsSubmitting(true);
    try {
      await saveCampaignData();

      const response = await fetch(`/api/admin/outbound-campaigns/${createdCampaignId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_mode: data.is_test_mode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to launch campaign");
      }

      toast({
        title: data.is_test_mode ? "Test Mode Started" : "Campaign Launched",
        description: data.is_test_mode
          ? `Campaign will make up to ${data.test_call_limit} test calls`
          : "Campaign is now active and making calls",
      });

      router.push(`/admin/outbound/${createdCampaignId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to launch campaign",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add structured data field
  const addDataField = () => {
    updateData("structured_data_schema", [
      ...data.structured_data_schema,
      { name: "", type: "string", description: "", required: false },
    ]);
  };

  const removeDataField = (index: number) => {
    updateData(
      "structured_data_schema",
      data.structured_data_schema.filter((_, i) => i !== index)
    );
  };

  const updateDataField = (index: number, field: string, value: unknown) => {
    const updated = [...data.structured_data_schema];
    updated[index] = { ...updated[index], [field]: value };
    updateData("structured_data_schema", updated);
  };

  // Add SMS template
  const addSmsTemplate = () => {
    updateData("sms_templates", [
      ...data.sms_templates,
      { name: "", trigger_type: "call_completed", template_body: "", link_url: "" },
    ]);
  };

  const removeSmsTemplate = (index: number) => {
    updateData(
      "sms_templates",
      data.sms_templates.filter((_, i) => i !== index)
    );
  };

  const updateSmsTemplate = (index: number, field: string, value: string) => {
    const updated = [...data.sms_templates];
    updated[index] = { ...updated[index], [field]: value };
    updateData("sms_templates", updated);
  };

  // Add end call condition
  const addEndCallCondition = () => {
    updateData("end_call_conditions", [...data.end_call_conditions, ""]);
  };

  const removeEndCallCondition = (index: number) => {
    updateData(
      "end_call_conditions",
      data.end_call_conditions.filter((_, i) => i !== index)
    );
  };

  const updateEndCallCondition = (index: number, value: string) => {
    const updated = [...data.end_call_conditions];
    updated[index] = value;
    updateData("end_call_conditions", updated);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Select Client</h2>
              <p className="text-muted-foreground">
                Choose the client this outbound campaign is for.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              {isLoadingClients ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading clients...</span>
                </div>
              ) : (
                <Select
                  value={data.client_id}
                  onValueChange={(value) => updateData("client_id", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                        {client.company_name && ` (${client.company_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Campaign Details</h2>
              <p className="text-muted-foreground">
                Provide basic information about your campaign.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={data.name}
                  onChange={(e) => updateData("name", e.target.value)}
                  placeholder="e.g., Q1 Sales Outreach"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={data.description}
                  onChange={(e) => updateData("description", e.target.value)}
                  placeholder="Brief description of this campaign..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">AI Agent Configuration</h2>
              <p className="text-muted-foreground">
                Configure the AI agent that will make calls for this campaign.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="voice">Voice</Label>
                <div className="flex gap-2">
                  <Select
                    value={data.voice_id}
                    onValueChange={(value) => {
                      const selectedVoice = VOICES.find(v => v.id === value);
                      updateData("voice_id", value);
                      if (selectedVoice) {
                        updateData("voice_provider", selectedVoice.provider);
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="max-h-[300px]">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted sticky top-0">
                        Vapi Voices (Optimized for AI)
                      </div>
                      {VAPI_VOICES.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div className="flex items-center gap-2 w-full">
                            <button
                              type="button"
                              onClick={(e) => handleVoicePreview(voice.id, voice.previewUrl, e)}
                              className="p-1 rounded-full hover:bg-primary/10 transition-colors"
                              title={playingVoiceId === voice.id ? "Stop preview" : "Play preview"}
                            >
                              {playingVoiceId === voice.id ? (
                                <Pause className="h-3 w-3 text-primary" />
                              ) : (
                                <Play className="h-3 w-3 text-primary" />
                              )}
                            </button>
                            <Mic className="h-4 w-4 text-primary" />
                            <span>{voice.name}</span>
                            <span className="text-xs text-muted-foreground">- {voice.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted sticky top-0 mt-1">
                        ElevenLabs Voices (High Quality)
                      </div>
                      {ELEVENLABS_VOICES.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div className="flex items-center gap-2 w-full">
                            <button
                              type="button"
                              onClick={(e) => handleVoicePreview(voice.id, voice.previewUrl, e)}
                              className="p-1 rounded-full hover:bg-purple-500/10 transition-colors"
                              title={playingVoiceId === voice.id ? "Stop preview" : "Play preview"}
                            >
                              {playingVoiceId === voice.id ? (
                                <Pause className="h-3 w-3 text-purple-500" />
                              ) : (
                                <Play className="h-3 w-3 text-purple-500" />
                              )}
                            </button>
                            <Mic className="h-4 w-4 text-purple-500" />
                            <span>{voice.name}</span>
                            <span className="text-xs text-muted-foreground">- {voice.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Preview button for currently selected voice */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      const selectedVoice = VOICES.find(v => v.id === data.voice_id);
                      if (selectedVoice) {
                        handleVoicePreview(selectedVoice.id, selectedVoice.previewUrl, e);
                      }
                    }}
                    title={playingVoiceId === data.voice_id ? "Stop preview" : "Preview selected voice"}
                  >
                    {playingVoiceId === data.voice_id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected: {VOICES.find(v => v.id === data.voice_id)?.name} ({data.voice_provider === "11labs" ? "ElevenLabs" : "Vapi"})
                  {" "}• Click the speaker icon to preview
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_message">First Message</Label>
                <Textarea
                  id="first_message"
                  value={data.first_message}
                  onChange={(e) => updateData("first_message", e.target.value)}
                  placeholder="Hello, this is..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{contact_name}}"}, {"{{company_name}}"} for dynamic values
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="system_prompt">System Prompt *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAIPromptDialog(true)}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate with AI
                  </Button>
                </div>
                <Textarea
                  id="system_prompt"
                  value={data.system_prompt}
                  onChange={(e) => updateData("system_prompt", e.target.value)}
                  placeholder="You are a friendly sales representative calling on behalf of..."
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Define the AI agent&apos;s personality, goals, and how it should handle the conversation.
                  Or click &quot;Generate with AI&quot; to create one automatically.
                </p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Data Collection Schema</h2>
              <p className="text-muted-foreground">
                Define what information the AI should collect during calls.
              </p>
            </div>
            <div className="space-y-4">
              {data.structured_data_schema.map((field, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Field Name</Label>
                        <Input
                          value={field.name}
                          onChange={(e) => updateDataField(index, "name", e.target.value)}
                          placeholder="e.g., interested"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) => updateDataField(index, "type", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATA_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={field.description}
                          onChange={(e) => updateDataField(index, "description", e.target.value)}
                          placeholder="What to collect"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={field.required}
                            onCheckedChange={(checked) => updateDataField(index, "required", checked)}
                          />
                          <Label className="text-sm">Required</Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDataField(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addDataField}>
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Call Settings</h2>
              <p className="text-muted-foreground">
                Configure call duration and end conditions.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max Call Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={data.max_duration_seconds}
                    onChange={(e) => updateData("max_duration_seconds", parseInt(e.target.value) || 0)}
                    min={30}
                    max={3600}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Silence Timeout (seconds)</Label>
                  <Input
                    type="number"
                    value={data.silence_timeout_seconds}
                    onChange={(e) => updateData("silence_timeout_seconds", parseInt(e.target.value) || 0)}
                    min={5}
                    max={120}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>End Call Phrases</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  The AI will end the call when these phrases are detected.
                </p>
                {data.end_call_conditions.map((condition, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={condition}
                      onChange={(e) => updateEndCallCondition(index, e.target.value)}
                      placeholder="e.g., goodbye"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEndCallCondition(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addEndCallCondition}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Phrase
                </Button>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Phone Number</h2>
              <p className="text-muted-foreground">
                Choose how to get a phone number for outbound calls.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card
                  className={`cursor-pointer transition-all ${
                    data.phone_number_option === "provision"
                      ? "ring-2 ring-primary"
                      : "hover:border-primary"
                  }`}
                  onClick={() => updateData("phone_number_option", "provision")}
                >
                  <CardHeader className="text-center">
                    <Phone className="h-8 w-8 mx-auto mb-2" />
                    <CardTitle className="text-base">Auto-Provision</CardTitle>
                    <CardDescription>Get a new number from Twilio</CardDescription>
                  </CardHeader>
                </Card>
                <Card
                  className={`cursor-pointer transition-all ${
                    data.phone_number_option === "existing"
                      ? "ring-2 ring-primary"
                      : "hover:border-primary"
                  }`}
                  onClick={() => updateData("phone_number_option", "existing")}
                >
                  <CardHeader className="text-center">
                    <Phone className="h-8 w-8 mx-auto mb-2" />
                    <CardTitle className="text-base">Use Existing</CardTitle>
                    <CardDescription>Select from your numbers</CardDescription>
                  </CardHeader>
                </Card>
                <Card
                  className={`cursor-pointer transition-all ${
                    data.phone_number_option === "manual"
                      ? "ring-2 ring-primary"
                      : "hover:border-primary"
                  }`}
                  onClick={() => updateData("phone_number_option", "manual")}
                >
                  <CardHeader className="text-center">
                    <Phone className="h-8 w-8 mx-auto mb-2" />
                    <CardTitle className="text-base">Manual Entry</CardTitle>
                    <CardDescription>Enter an existing number</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              {data.phone_number_option === "provision" && (
                <div className="space-y-2">
                  <Label>Preferred Area Code (optional)</Label>
                  <Input
                    value={data.area_code}
                    onChange={(e) => updateData("area_code", e.target.value)}
                    placeholder="e.g., 212"
                    maxLength={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to auto-select based on your location
                  </p>
                </div>
              )}

              {data.phone_number_option === "manual" && (
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={data.manual_phone_number}
                    onChange={(e) => updateData("manual_phone_number", e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Call Schedule</h2>
              <p className="text-muted-foreground">
                Set when calls should be made based on contact timezones.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={data.schedule_days.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (data.schedule_days.includes(day.value)) {
                          updateData(
                            "schedule_days",
                            data.schedule_days.filter((d) => d !== day.value)
                          );
                        } else {
                          updateData("schedule_days", [...data.schedule_days, day.value]);
                        }
                      }}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={data.schedule_start_time}
                    onChange={(e) => updateData("schedule_start_time", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={data.schedule_end_time}
                    onChange={(e) => updateData("schedule_end_time", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={data.schedule_timezone}
                    onValueChange={(value) => updateData("schedule_timezone", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Calls will be made during these hours in the contact&apos;s local timezone.
              </p>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">SMS Follow-up Templates</h2>
              <p className="text-muted-foreground">
                Configure automated SMS messages to send after calls.
              </p>
            </div>
            <div className="space-y-4">
              {data.sms_templates.map((template, index) => (
                <Card key={index}>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="grid gap-4 md:grid-cols-2 flex-1">
                        <div className="space-y-2">
                          <Label>Template Name</Label>
                          <Input
                            value={template.name}
                            onChange={(e) => updateSmsTemplate(index, "name", e.target.value)}
                            placeholder="e.g., Thank You SMS"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Trigger</Label>
                          <Select
                            value={template.trigger_type}
                            onValueChange={(value) => updateSmsTemplate(index, "trigger_type", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SMS_TRIGGER_TYPES.map((trigger) => (
                                <SelectItem key={trigger.value} value={trigger.value}>
                                  {trigger.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSmsTemplate(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Message Body</Label>
                      <Textarea
                        value={template.template_body}
                        onChange={(e) => updateSmsTemplate(index, "template_body", e.target.value)}
                        placeholder="Hi {{contact_name}}, thank you for speaking with us..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Link URL (optional)</Label>
                      <Input
                        value={template.link_url}
                        onChange={(e) => updateSmsTemplate(index, "link_url", e.target.value)}
                        placeholder="https://example.com/schedule"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addSmsTemplate}>
                <Plus className="mr-2 h-4 w-4" />
                Add SMS Template
              </Button>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Contact List</h2>
              <p className="text-muted-foreground">
                Upload your contact list for this campaign.
              </p>
            </div>
            {createdCampaignId ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium mb-2">Upload Contacts</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a CSV file with your contact list. You can also add contacts later.
                  </p>
                  <Button variant="outline" asChild>
                    <Link href={`/admin/outbound/${createdCampaignId}/contacts`}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload CSV
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>Complete the previous steps to enable contact upload.</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 10:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Retry Settings</h2>
              <p className="text-muted-foreground">
                Configure how the system handles unanswered calls.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Auto-Retry</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically retry unanswered calls
                  </p>
                </div>
                <Switch
                  checked={data.retry_enabled}
                  onCheckedChange={(checked) => updateData("retry_enabled", checked)}
                />
              </div>
              {data.retry_enabled && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Retry Attempts</Label>
                    <Input
                      type="number"
                      value={data.retry_attempts}
                      onChange={(e) => updateData("retry_attempts", parseInt(e.target.value) || 0)}
                      min={1}
                      max={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delay Between Retries (minutes)</Label>
                    <Input
                      type="number"
                      value={data.retry_delay_minutes}
                      onChange={(e) => updateData("retry_delay_minutes", parseInt(e.target.value) || 0)}
                      min={15}
                      max={1440}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Max Concurrent Calls</Label>
                <Input
                  type="number"
                  value={data.max_concurrent_calls}
                  onChange={(e) => updateData("max_concurrent_calls", parseInt(e.target.value) || 1)}
                  min={1}
                  max={50}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of simultaneous calls
                </p>
              </div>
            </div>
          </div>
        );

      case 11:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Billing Settings</h2>
              <p className="text-muted-foreground">
                Configure the billing rate for this campaign.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rate Per Minute ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={data.rate_per_minute}
                    onChange={(e) => updateData("rate_per_minute", e.target.value)}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Threshold ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={data.billing_threshold}
                    onChange={(e) => updateData("billing_threshold", e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Campaign pauses when this threshold is reached without payment
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 12:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Review & Launch</h2>
              <p className="text-muted-foreground">
                Review your campaign settings before launching.
              </p>
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Campaign Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">{data.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Client</Label>
                      <p className="font-medium">
                        {clients.find((c) => c.id === data.client_id)?.name || "Not selected"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Voice</Label>
                      <p className="font-medium">
                        {VOICES.find((v) => v.id === data.voice_id)?.name || data.voice_id}
                        <span className="text-sm text-muted-foreground ml-1">
                          ({data.voice_provider === "11labs" ? "ElevenLabs" : "Vapi"})
                        </span>
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Schedule</Label>
                      <p className="font-medium">
                        {data.schedule_days.map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label).join(", ")}
                        {" "}{data.schedule_start_time} - {data.schedule_end_time}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Rate</Label>
                      <p className="font-medium">${data.rate_per_minute}/min</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Retry</Label>
                      <p className="font-medium">
                        {data.retry_enabled ? `${data.retry_attempts} attempts` : "Disabled"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Launch Mode</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Test Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Make a limited number of test calls before going live
                      </p>
                    </div>
                    <Switch
                      checked={data.is_test_mode}
                      onCheckedChange={(checked) => updateData("is_test_mode", checked)}
                    />
                  </div>
                  {data.is_test_mode && (
                    <div className="space-y-2">
                      <Label>Test Call Limit</Label>
                      <Input
                        type="number"
                        value={data.test_call_limit}
                        onChange={(e) => updateData("test_call_limit", parseInt(e.target.value) || 1)}
                        min={1}
                        max={100}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/outbound">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Outbound Campaign</h1>
          <p className="text-muted-foreground">
            Create an AI-powered outbound calling campaign
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Step {currentStep} of {STEPS.length}</span>
          <span>{STEPS[currentStep - 1].title}</span>
        </div>
        <Progress value={(currentStep / STEPS.length) * 100} />
      </div>

      {/* Step Indicators */}
      <div className="hidden md:flex justify-between">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={`flex flex-col items-center gap-1 ${
              step.id === currentStep
                ? "text-primary"
                : step.id < currentStep
                ? "text-green-600"
                : "text-muted-foreground"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step.id === currentStep
                  ? "bg-primary text-primary-foreground"
                  : step.id < currentStep
                  ? "bg-green-600 text-white"
                  : "bg-muted"
              }`}
            >
              {step.id < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                <step.icon className="h-4 w-4" />
              )}
            </div>
            <span className="text-xs">{step.title}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">{renderStep()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          {createdCampaignId && (
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSubmitting}>
              Save Draft
            </Button>
          )}
          {currentStep === 12 ? (
            <Button onClick={handleLaunch} disabled={isSubmitting || !createdCampaignId}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Play className="mr-2 h-4 w-4" />
              {data.is_test_mode ? "Start Test" : "Launch Campaign"}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={isSubmitting || !canProceed()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* AI Prompt Generator Dialog */}
      <Dialog open={showAIPromptDialog} onOpenChange={setShowAIPromptDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate System Prompt with AI
            </DialogTitle>
            <DialogDescription>
              Describe what you want your AI calling agent to do, and we&apos;ll generate a comprehensive system prompt for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ai-description">What should the AI agent do?</Label>
              <Textarea
                id="ai-description"
                value={aiPromptDescription}
                onChange={(e) => setAiPromptDescription(e.target.value)}
                placeholder="Example: Make sales calls to introduce our new software product. Be friendly and professional. Collect contact information from interested leads and schedule follow-up demos."
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Include details about the purpose, tone, and any specific information you want to collect.
              </p>
            </div>
            {data.client_id && clients.find(c => c.id === data.client_id) && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="text-muted-foreground">Company: </span>
                <span className="font-medium">
                  {clients.find(c => c.id === data.client_id)?.company_name ||
                   clients.find(c => c.id === data.client_id)?.name}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAIPromptDialog(false);
                setAiPromptDescription("");
              }}
              disabled={isGeneratingPrompt}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGeneratePrompt}
              disabled={isGeneratingPrompt || !aiPromptDescription.trim()}
            >
              {isGeneratingPrompt ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Prompt
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
