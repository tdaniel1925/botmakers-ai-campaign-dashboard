"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Building2,
  FileText,
  Key,
  Calendar,
  MessageSquare,
  DollarSign,
  Users,
  Play,
  Settings,
  Upload,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  TestTube,
  CheckCircle,
  Info,
} from "lucide-react";

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
  // Step 3: Call Provider Configuration
  call_provider: "vapi" | "autocalls" | "synthflow";
  // Vapi-specific
  vapi_key_source: "system" | "client";
  vapi_api_key: string;
  vapi_assistant_id: string;
  vapi_phone_number_id: string;
  // AutoCalls-specific
  autocalls_key_source: "system" | "client";
  autocalls_api_key: string;
  autocalls_assistant_id: string;
  // Synthflow-specific
  synthflow_key_source: "system" | "client";
  synthflow_api_key: string;
  synthflow_model_id: string;
  // Step 4: Schedule
  schedule_days: number[];
  schedule_start_time: string;
  schedule_end_time: string;
  schedule_timezone: string;
  // Step 5: SMS Templates
  sms_templates: Array<{
    name: string;
    trigger_type: string;
    template_body: string;
    link_url: string;
  }>;
  // Step 6: Contact List (handled separately via upload)
  // Step 7: Retry Settings
  retry_enabled: boolean;
  retry_attempts: number;
  retry_delay_minutes: number;
  max_concurrent_calls: number;
  calls_per_minute: number;
  // Step 8: Billing
  rate_per_minute: string;
  billing_threshold: string;
  // Step 9: Review & Launch
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
  { id: 3, title: "Call Provider", icon: Key },
  { id: 4, title: "Schedule", icon: Calendar },
  { id: 5, title: "SMS", icon: MessageSquare },
  { id: 6, title: "Contacts", icon: Users },
  { id: 7, title: "Retry", icon: Settings },
  { id: 8, title: "Billing", icon: DollarSign },
  { id: 9, title: "Review", icon: Play },
];

const CALL_PROVIDERS = [
  { value: "vapi", label: "Vapi", description: "Vapi.ai voice agents" },
  { value: "autocalls", label: "AutoCalls.ai", description: "AutoCalls.ai voice agents" },
  { value: "synthflow", label: "Synthflow", description: "Synthflow AI voice agents" },
];

const initialData: WizardData = {
  client_id: "",
  name: "",
  description: "",
  call_provider: "vapi",
  vapi_key_source: "system",
  vapi_api_key: "",
  vapi_assistant_id: "",
  vapi_phone_number_id: "",
  autocalls_key_source: "system",
  autocalls_api_key: "",
  autocalls_assistant_id: "",
  synthflow_key_source: "system",
  synthflow_api_key: "",
  synthflow_model_id: "",
  schedule_days: [1, 2, 3, 4, 5], // Mon-Fri
  schedule_start_time: "09:00",
  schedule_end_time: "17:00",
  schedule_timezone: "America/New_York",
  sms_templates: [],
  retry_enabled: true,
  retry_attempts: 2,
  retry_delay_minutes: 60,
  max_concurrent_calls: 5,
  calls_per_minute: 30,
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
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidatingVapi, setIsValidatingVapi] = useState(false);
  const [vapiValidationError, setVapiValidationError] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

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
    if (vapiValidationError) {
      setVapiValidationError(null);
    }
  };

  // Validate provider credentials
  const validateProviderCredentials = async () => {
    setIsValidatingVapi(true);
    setVapiValidationError(null);

    try {
      // Validate based on selected provider
      switch (data.call_provider) {
        case "vapi":
          // If using system keys, only validate assistant ID format
          if (data.vapi_key_source === "system") {
            if (!data.vapi_assistant_id.trim()) {
              setVapiValidationError("Assistant ID is required");
              return false;
            }
            return true;
          }
          // Validate client Vapi credentials
          if (!data.vapi_api_key || !data.vapi_assistant_id) {
            setVapiValidationError("API Key and Assistant ID are required");
            return false;
          }
          // Call Vapi API to validate
          const vapiResponse = await fetch(`https://api.vapi.ai/assistant/${data.vapi_assistant_id}`, {
            headers: { Authorization: `Bearer ${data.vapi_api_key}` },
          });
          if (!vapiResponse.ok) {
            if (vapiResponse.status === 401) {
              setVapiValidationError("Invalid API Key");
              return false;
            }
            if (vapiResponse.status === 404) {
              setVapiValidationError("Assistant not found");
              return false;
            }
            setVapiValidationError("Failed to validate Vapi credentials");
            return false;
          }
          break;

        case "autocalls":
          // If using system keys, only validate assistant ID
          if (data.autocalls_key_source === "system") {
            if (!data.autocalls_assistant_id.trim()) {
              setVapiValidationError("Assistant ID is required");
              return false;
            }
          } else {
            if (!data.autocalls_api_key || !data.autocalls_assistant_id) {
              setVapiValidationError("API Key and Assistant ID are required for AutoCalls");
              return false;
            }
          }
          // Basic format validation (AutoCalls uses integer IDs)
          if (isNaN(parseInt(data.autocalls_assistant_id))) {
            setVapiValidationError("AutoCalls Assistant ID must be a number");
            return false;
          }
          break;

        case "synthflow":
          // If using system keys, only validate agent ID
          if (data.synthflow_key_source === "system") {
            if (!data.synthflow_model_id.trim()) {
              setVapiValidationError("Agent ID is required");
              return false;
            }
          } else {
            if (!data.synthflow_api_key || !data.synthflow_model_id) {
              setVapiValidationError("API Key and Agent ID are required for Synthflow");
              return false;
            }
          }
          break;
      }

      toast({
        title: "Credentials validated",
        description: "Your provider credentials look valid.",
      });
      return true;
    } catch (error) {
      console.error("Provider validation error:", error);
      setVapiValidationError("Failed to validate credentials.");
      return false;
    } finally {
      setIsValidatingVapi(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!data.client_id;
      case 2:
        return !!data.name;
      case 3:
        // Validate based on selected provider
        switch (data.call_provider) {
          case "vapi":
            if (data.vapi_key_source === "system") {
              return !!data.vapi_assistant_id.trim();
            }
            return !!data.vapi_api_key.trim() && !!data.vapi_assistant_id.trim();
          case "autocalls":
            if (data.autocalls_key_source === "system") {
              return !!data.autocalls_assistant_id.trim();
            }
            return !!data.autocalls_api_key.trim() && !!data.autocalls_assistant_id.trim();
          case "synthflow":
            if (data.synthflow_key_source === "system") {
              return !!data.synthflow_model_id.trim();
            }
            return !!data.synthflow_api_key.trim() && !!data.synthflow_model_id.trim();
          default:
            return false;
        }
      case 4:
        return data.schedule_days.length > 0 && !!data.schedule_start_time && !!data.schedule_end_time;
      case 8:
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

    // Validate provider credentials on step 3
    if (currentStep === 3) {
      const isValid = await validateProviderCredentials();
      if (!isValid) return;
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

    if (currentStep < STEPS.length) {
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

    // Build provider-specific config based on selected provider
    const providerConfig: Record<string, unknown> = {
      call_provider: data.call_provider,
    };

    switch (data.call_provider) {
      case "vapi":
        providerConfig.vapi_key_source = data.vapi_key_source;
        providerConfig.vapi_api_key = data.vapi_key_source === "client" ? data.vapi_api_key : null;
        providerConfig.vapi_assistant_id = data.vapi_assistant_id;
        providerConfig.vapi_phone_number_id = data.vapi_phone_number_id || null;
        break;
      case "autocalls":
        providerConfig.provider_api_key = data.autocalls_api_key;
        providerConfig.autocalls_assistant_id = parseInt(data.autocalls_assistant_id);
        break;
      case "synthflow":
        providerConfig.provider_api_key = data.synthflow_api_key;
        providerConfig.synthflow_model_id = data.synthflow_model_id;
        break;
    }

    const response = await fetch(`/api/admin/outbound-campaigns/${createdCampaignId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description || null,
        ...providerConfig,
        retry_enabled: data.retry_enabled,
        retry_attempts: data.retry_attempts,
        retry_delay_minutes: data.retry_delay_minutes,
        max_concurrent_calls: data.max_concurrent_calls,
        calls_per_minute: data.calls_per_minute,
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

  const handleCreateCampaign = async () => {
    setIsSubmitting(true);
    try {
      // Save the campaign (creates if not exists, updates if exists)
      await saveCampaignData();

      // Get the campaign ID (either already created or just created)
      const campaignId = createdCampaignId;

      if (!campaignId) {
        throw new Error("Campaign was not created properly");
      }

      toast({
        title: "Campaign Created!",
        description: "Your campaign has been saved as a draft. You can start it from the campaign details page.",
      });

      // Redirect to the campaign details page
      router.push(`/admin/outbound/${campaignId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
              <h2 className="text-xl font-semibold mb-2">Call Provider</h2>
              <p className="text-muted-foreground">
                Choose and configure the AI voice provider that will handle outbound calls.
              </p>
            </div>

            <div className="space-y-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>Call Provider *</Label>
                <Select
                  value={data.call_provider}
                  onValueChange={(value: "vapi" | "autocalls" | "synthflow") => updateData("call_provider", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALL_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        <div className="flex flex-col">
                          <span>{provider.label}</span>
                          <span className="text-xs text-muted-foreground">{provider.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vapi Configuration */}
              {data.call_provider === "vapi" && (
                <>
                  <div className="space-y-2">
                    <Label>API Key Source</Label>
                    <Select
                      value={data.vapi_key_source}
                      onValueChange={(value: "system" | "client") => updateData("vapi_key_source", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System Keys (Bill to Client)</SelectItem>
                        <SelectItem value="client">Client&apos;s Own Keys</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {data.vapi_key_source === "client" && (
                    <div className="space-y-2">
                      <Label htmlFor="vapi_api_key">Vapi API Key *</Label>
                      <div className="relative">
                        <Input
                          id="vapi_api_key"
                          type={showApiKey ? "text" : "password"}
                          value={data.vapi_api_key}
                          onChange={(e) => updateData("vapi_api_key", e.target.value)}
                          placeholder="vapi_xxxxxxxx..."
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
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="vapi_assistant_id">Assistant ID *</Label>
                    <Input
                      id="vapi_assistant_id"
                      value={data.vapi_assistant_id}
                      onChange={(e) => updateData("vapi_assistant_id", e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vapi_phone_number_id">Phone Number ID</Label>
                    <Input
                      id="vapi_phone_number_id"
                      value={data.vapi_phone_number_id}
                      onChange={(e) => updateData("vapi_phone_number_id", e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">Optional</p>
                  </div>
                </>
              )}

              {/* AutoCalls Configuration */}
              {data.call_provider === "autocalls" && (
                <>
                  <div className="space-y-2">
                    <Label>API Key Source</Label>
                    <Select
                      value={data.autocalls_key_source}
                      onValueChange={(value: "system" | "client") => updateData("autocalls_key_source", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System Keys (Bill to Client)</SelectItem>
                        <SelectItem value="client">Client&apos;s Own Keys</SelectItem>
                      </SelectContent>
                    </Select>
                    {data.autocalls_key_source === "system" && (
                      <p className="text-xs text-muted-foreground">
                        Platform-level API keys from Settings will be used. Usage will be billed to the client.
                      </p>
                    )}
                  </div>

                  {data.autocalls_key_source === "client" && (
                    <>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex gap-3">
                          <Key className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="font-medium text-blue-900 dark:text-blue-100">AutoCalls.ai Credentials</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Get your API key and Assistant ID from{" "}
                              <a href="https://app.autocalls.ai" target="_blank" rel="noopener noreferrer" className="underline">
                                app.autocalls.ai <ExternalLink className="inline h-3 w-3" />
                              </a>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="autocalls_api_key">API Key *</Label>
                        <div className="relative">
                          <Input
                            id="autocalls_api_key"
                            type={showApiKey ? "text" : "password"}
                            value={data.autocalls_api_key}
                            onChange={(e) => updateData("autocalls_api_key", e.target.value)}
                            placeholder="Your AutoCalls API key"
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
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="autocalls_assistant_id">Assistant ID *</Label>
                    <Input
                      id="autocalls_assistant_id"
                      value={data.autocalls_assistant_id}
                      onChange={(e) => updateData("autocalls_assistant_id", e.target.value)}
                      placeholder="123456"
                    />
                    <p className="text-xs text-muted-foreground">Numeric ID from your AutoCalls dashboard</p>
                  </div>
                </>
              )}

              {/* Synthflow Configuration */}
              {data.call_provider === "synthflow" && (
                <>
                  <div className="space-y-2">
                    <Label>API Key Source</Label>
                    <Select
                      value={data.synthflow_key_source}
                      onValueChange={(value: "system" | "client") => updateData("synthflow_key_source", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System Keys (Bill to Client)</SelectItem>
                        <SelectItem value="client">Client&apos;s Own Keys</SelectItem>
                      </SelectContent>
                    </Select>
                    {data.synthflow_key_source === "system" && (
                      <p className="text-xs text-muted-foreground">
                        Platform-level API keys from Settings will be used. Usage will be billed to the client.
                      </p>
                    )}
                  </div>

                  {data.synthflow_key_source === "client" && (
                    <>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex gap-3">
                          <Key className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="font-medium text-blue-900 dark:text-blue-100">Synthflow Credentials</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Get your API key and Agent ID from{" "}
                              <a href="https://app.synthflow.ai" target="_blank" rel="noopener noreferrer" className="underline">
                                app.synthflow.ai <ExternalLink className="inline h-3 w-3" />
                              </a>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="synthflow_api_key">API Key *</Label>
                        <div className="relative">
                          <Input
                            id="synthflow_api_key"
                            type={showApiKey ? "text" : "password"}
                            value={data.synthflow_api_key}
                            onChange={(e) => updateData("synthflow_api_key", e.target.value)}
                            placeholder="Your Synthflow API key"
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
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="synthflow_model_id">Agent ID (model_id) *</Label>
                    <Input
                      id="synthflow_model_id"
                      value={data.synthflow_model_id}
                      onChange={(e) => updateData("synthflow_model_id", e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">Found on your agent&apos;s page in Synthflow</p>
                  </div>
                </>
              )}

              {/* Validation error */}
              {vapiValidationError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{vapiValidationError}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 4:
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

      case 5:
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

      case 6:
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

      case 7:
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
              <div className="grid gap-4 md:grid-cols-2">
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
                <div className="space-y-2">
                  <Label>Calls Per Minute</Label>
                  <Input
                    type="number"
                    value={data.calls_per_minute}
                    onChange={(e) => updateData("calls_per_minute", parseInt(e.target.value) || 1)}
                    min={1}
                    max={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Rate limit for initiating new calls
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 8:
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

      case 9:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Review & Create</h2>
              <p className="text-muted-foreground">
                Review your campaign settings. After creating, you can start the campaign from the campaign details page.
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
                      <Label className="text-muted-foreground">Call Provider</Label>
                      <p className="font-medium">
                        {data.call_provider === "vapi" ? "Vapi" : data.call_provider === "autocalls" ? "AutoCalls.ai" : "Synthflow"}
                        {" "}
                        ({data.call_provider === "vapi"
                          ? (data.vapi_key_source === "system" ? "System Keys" : "Client Keys")
                          : data.call_provider === "autocalls"
                          ? (data.autocalls_key_source === "system" ? "System Keys" : "Client Keys")
                          : (data.synthflow_key_source === "system" ? "System Keys" : "Client Keys")
                        })
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Schedule</Label>
                      <p className="font-medium">
                        {data.schedule_days.map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label.slice(0,3)).join(", ")}
                        {" "}{data.schedule_start_time} - {data.schedule_end_time}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Rate</Label>
                      <p className="font-medium">${data.rate_per_minute}/min</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Limits</Label>
                      <p className="font-medium">
                        {data.max_concurrent_calls} concurrent, {data.calls_per_minute}/min
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Test Mode Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TestTube className="h-4 w-4" />
                    Test Mode Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Test Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, campaign will pause after the test call limit is reached
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
                      <p className="text-xs text-muted-foreground">
                        Campaign will automatically pause after this many calls. You can then review results and decide to continue.
                      </p>
                    </div>
                  )}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Recommended:</strong> Enable test mode for new campaigns. Make 5-10 test calls to verify your AI agent
                        is working correctly before launching at full scale.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* What Happens Next */}
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-4 w-4" />
                    What Happens After Creating
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li><strong>Campaign Created as Draft</strong> - Your campaign will be saved but not started yet</li>
                    <li><strong>Webhook URL Generated</strong> - A unique webhook URL will be created for receiving call data</li>
                    <li><strong>Upload Contacts</strong> - Add your contact list from the campaign details page</li>
                    <li><strong>Start Campaign</strong> - When ready, start the campaign from the campaign card or details page</li>
                  </ol>
                  <div className="pt-2 border-t border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      <strong>Note:</strong> Campaigns are created in &quot;draft&quot; status. You control when to start calling from the campaign management page.
                    </p>
                  </div>
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
          {currentStep === STEPS.length ? (
            <Button onClick={handleCreateCampaign} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={isSubmitting || isValidatingVapi || !canProceed()}>
              {(isSubmitting || isValidatingVapi) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isValidatingVapi ? "Validating..." : "Next"}
              {!isValidatingVapi && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
