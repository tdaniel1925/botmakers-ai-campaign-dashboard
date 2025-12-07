"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Key,
  Webhook,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  company_name: string | null;
}

interface WizardData {
  client_id: string;
  name: string;
  description: string;
  // Vapi Credentials
  vapi_api_key: string;
  vapi_assistant_id: string;
  vapi_phone_number_id: string;
}

const initialData: WizardData = {
  client_id: "",
  name: "",
  description: "",
  vapi_api_key: "",
  vapi_assistant_id: "",
  vapi_phone_number_id: "",
};

const WIZARD_STEPS = [
  { id: 1, name: "Basics", icon: Building2 },
  { id: 2, name: "Vapi Config", icon: Key },
  { id: 3, name: "Review", icon: CheckCircle2 },
];

export default function NewInboundCampaignPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCampaign, setCreatedCampaign] = useState<{ id: string; webhookToken: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidatingVapi, setIsValidatingVapi] = useState(false);
  const [vapiValidationError, setVapiValidationError] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  // Fetch clients
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

  const updateData = (field: keyof WizardData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error when user types
    if (vapiValidationError) {
      setVapiValidationError(null);
    }
  };

  // Validate Vapi credentials
  const validateVapiCredentials = async () => {
    if (!data.vapi_api_key || !data.vapi_assistant_id) {
      setVapiValidationError("API Key and Assistant ID are required");
      return false;
    }

    setIsValidatingVapi(true);
    setVapiValidationError(null);

    try {
      // Validate API key by fetching assistants
      const assistantResponse = await fetch(`https://api.vapi.ai/assistant/${data.vapi_assistant_id}`, {
        headers: {
          Authorization: `Bearer ${data.vapi_api_key}`,
        },
      });

      if (!assistantResponse.ok) {
        if (assistantResponse.status === 401) {
          setVapiValidationError("Invalid API Key. Please check your Vapi private key.");
          return false;
        }
        if (assistantResponse.status === 404) {
          setVapiValidationError("Assistant not found. Please check your Assistant ID.");
          return false;
        }
        setVapiValidationError("Failed to validate credentials. Please check your API Key and Assistant ID.");
        return false;
      }

      // Optionally validate phone number if provided
      if (data.vapi_phone_number_id) {
        const phoneResponse = await fetch(`https://api.vapi.ai/phone-number/${data.vapi_phone_number_id}`, {
          headers: {
            Authorization: `Bearer ${data.vapi_api_key}`,
          },
        });

        if (!phoneResponse.ok) {
          if (phoneResponse.status === 404) {
            setVapiValidationError("Phone Number not found. Please check your Phone Number ID.");
            return false;
          }
        }
      }

      toast({
        title: "Credentials validated",
        description: "Your Vapi credentials are valid.",
      });
      return true;
    } catch (error) {
      console.error("Vapi validation error:", error);
      setVapiValidationError("Failed to connect to Vapi. Please check your internet connection.");
      return false;
    } finally {
      setIsValidatingVapi(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.client_id && data.name.trim();
      case 2:
        return data.vapi_api_key.trim() && data.vapi_assistant_id.trim();
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 2) {
      // Validate Vapi credentials before proceeding
      const isValid = await validateVapiCredentials();
      if (!isValid) return;
    }

    if (currentStep < WIZARD_STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit the campaign
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/inbound-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: data.client_id,
          name: data.name,
          description: data.description || null,
          vapi_api_key: data.vapi_api_key,
          vapi_assistant_id: data.vapi_assistant_id,
          vapi_phone_number_id: data.vapi_phone_number_id || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create campaign");
      }

      const campaign = await response.json();
      setCreatedCampaign({ id: campaign.id, webhookToken: campaign.webhook_token });

      toast({
        title: "Campaign created!",
        description: "Your inbound campaign has been created successfully.",
      });
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

  const copyWebhookUrl = () => {
    if (!createdCampaign) return;
    const webhookUrl = `${window.location.origin}/api/webhooks/${createdCampaign.webhookToken}`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied!",
      description: "Webhook URL copied to clipboard",
    });
  };

  // Render step content
  const renderStepContent = () => {
    // Success screen
    if (createdCampaign) {
      const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/${createdCampaign.webhookToken}`;
      return (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Campaign Created!</h2>
            <p className="text-muted-foreground">
              Your inbound campaign is ready. Use the webhook URL below to receive call data.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Webhook className="h-5 w-5" />
                Webhook URL
              </CardTitle>
              <CardDescription>
                Send POST requests with call data to this URL
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => router.push("/admin/inbound")}>
              View All Campaigns
            </Button>
            <Button onClick={() => router.push(`/admin/inbound/${createdCampaign.id}`)}>
              Go to Campaign
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Campaign Basics</h2>
              <p className="text-muted-foreground">
                Set up the basic information for your inbound campaign.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                {isLoadingClients ? (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading clients...</span>
                  </div>
                ) : (
                  <Select value={data.client_id} onValueChange={(v) => updateData("client_id", v)}>
                    <SelectTrigger>
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
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={data.name}
                  onChange={(e) => updateData("name", e.target.value)}
                  placeholder="Customer Support Line"
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

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Vapi Configuration</h2>
              <p className="text-muted-foreground">
                Enter your Vapi credentials to connect your AI assistant.
              </p>
            </div>

            {/* Help link */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex gap-3">
                <Key className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium text-blue-900 dark:text-blue-100">Where to find your Vapi credentials</p>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>
                      <strong>API Key:</strong> Go to{" "}
                      <a
                        href="https://dashboard.vapi.ai/account"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline inline-flex items-center gap-1"
                      >
                        Vapi Dashboard → Account
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>
                      <strong>Assistant ID:</strong> Go to{" "}
                      <a
                        href="https://dashboard.vapi.ai/assistants"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline inline-flex items-center gap-1"
                      >
                        Vapi Dashboard → Assistants
                        <ExternalLink className="h-3 w-3" />
                      </a>{" "}
                      and copy the ID
                    </li>
                    <li>
                      <strong>Phone Number ID:</strong> Go to{" "}
                      <a
                        href="https://dashboard.vapi.ai/phone-numbers"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline inline-flex items-center gap-1"
                      >
                        Vapi Dashboard → Phone Numbers
                        <ExternalLink className="h-3 w-3" />
                      </a>{" "}
                      and copy the ID
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vapi_api_key">Vapi API Key (Private Key) *</Label>
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
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your private API key from the Vapi dashboard. This will be encrypted and stored securely.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vapi_assistant_id">Assistant ID *</Label>
                <Input
                  id="vapi_assistant_id"
                  value={data.vapi_assistant_id}
                  onChange={(e) => updateData("vapi_assistant_id", e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                <p className="text-xs text-muted-foreground">
                  The ID of the Vapi assistant that will handle calls.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vapi_phone_number_id">Phone Number ID</Label>
                <Input
                  id="vapi_phone_number_id"
                  value={data.vapi_phone_number_id}
                  onChange={(e) => updateData("vapi_phone_number_id", e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. The ID of the Vapi phone number to use for this campaign.
                </p>
              </div>

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

      case 3:
        const selectedClient = clients.find(c => c.id === data.client_id);
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Review & Create</h2>
              <p className="text-muted-foreground">
                Review your campaign settings before creating.
              </p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Campaign Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{selectedClient?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Campaign Name</p>
                    <p className="font-medium">{data.name || "-"}</p>
                  </div>
                </div>
                {data.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{data.description}</p>
                  </div>
                )}
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-3">Vapi Configuration</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">API Key</p>
                      <p className="font-medium font-mono text-sm">
                        {data.vapi_api_key.substring(0, 10)}...{data.vapi_api_key.substring(data.vapi_api_key.length - 4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Assistant ID</p>
                      <p className="font-medium font-mono text-sm">{data.vapi_assistant_id}</p>
                    </div>
                    {data.vapi_phone_number_id && (
                      <div>
                        <p className="text-sm text-muted-foreground">Phone Number ID</p>
                        <p className="font-medium font-mono text-sm">{data.vapi_phone_number_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex gap-3">
                <Webhook className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">Webhook will be generated</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    A unique webhook URL will be created for this campaign. You can use it to receive call data from any source.
                  </p>
                </div>
              </div>
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
      <div className="flex items-center space-x-4">
        <Link href="/admin/campaigns/new">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Inbound Campaign</h1>
          <p className="text-muted-foreground">
            Set up an AI-powered inbound calling campaign
          </p>
        </div>
      </div>

      {/* Stepper */}
      {!createdCampaign && (
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-2">
            {WIZARD_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    currentStep === step.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : currentStep > step.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.name}
                </span>
                {index < WIZARD_STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-4 ${
                      currentStep > step.id ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <Card className="max-w-3xl mx-auto">
        <CardContent className="pt-6">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      {!createdCampaign && (
        <div className="flex justify-between max-w-3xl mx-auto">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleNext} disabled={isSubmitting || isValidatingVapi || !canProceed()}>
            {(isSubmitting || isValidatingVapi) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isValidatingVapi ? "Validating..." : currentStep === WIZARD_STEPS.length ? "Create Campaign" : "Next"}
            {currentStep < WIZARD_STEPS.length && !isValidatingVapi && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
