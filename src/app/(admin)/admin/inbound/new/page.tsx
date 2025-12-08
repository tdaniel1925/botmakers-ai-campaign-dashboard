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
  Webhook,
  CheckCircle2,
  Copy,
  Info,
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
}

const initialData: WizardData = {
  client_id: "",
  name: "",
  description: "",
};

const WIZARD_STEPS = [
  { id: 1, name: "Basics", icon: Building2 },
  { id: 2, name: "Review", icon: CheckCircle2 },
];

export default function NewInboundCampaignPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCampaign, setCreatedCampaign] = useState<{ id: string; webhookToken: string } | null>(null);

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
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.client_id && data.name.trim();
      case 2:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
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
                Send POST requests with call data to this URL from any AI voice provider
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
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-medium text-blue-900 dark:text-blue-100">Next Steps</p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                  <li>Configure your AI voice provider (Vapi, Bland, Retell, etc.) to send webhooks to this URL</li>
                  <li>The system will automatically parse and store call data</li>
                  <li>Set up outcome tags and SMS rules from the campaign dashboard</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => router.push("/admin/inbound")}>
              View All Campaigns
            </Button>
            <Button onClick={() => router.push(`/admin/campaigns/${createdCampaign.id}`)}>
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
            <div className="bg-muted/50 border rounded-lg p-4">
              <div className="flex gap-3">
                <Webhook className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Provider-Agnostic Webhooks</p>
                  <p className="text-sm text-muted-foreground">
                    This campaign will receive call data via webhook. You can connect any AI voice provider
                    (Vapi, Bland, Retell, etc.) - the system will automatically parse incoming payloads.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
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
              </CardContent>
            </Card>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex gap-3">
                <Webhook className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">Webhook will be generated</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    A unique webhook URL will be created for this campaign. Configure your AI voice provider
                    to send call data to this URL.
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
        <Link href="/admin/inbound">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Inbound Campaign</h1>
          <p className="text-muted-foreground">
            Set up a campaign to receive and analyze inbound call data
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
          <Button onClick={handleNext} disabled={isSubmitting || !canProceed()}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {currentStep === WIZARD_STEPS.length ? "Create Campaign" : "Next"}
            {currentStep < WIZARD_STEPS.length && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
