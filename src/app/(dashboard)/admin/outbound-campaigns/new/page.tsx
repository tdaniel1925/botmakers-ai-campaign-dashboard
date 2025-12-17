'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Upload,
  Phone,
  Calendar,
  MessageSquare,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Organization {
  id: string;
  name: string;
}

interface VapiAssistant {
  id: string;
  name: string;
  model?: { provider: string; model: string };
  voice?: { provider: string; voiceId: string };
  firstMessage?: string;
}

interface VapiPhoneNumber {
  id: string;
  number: string;
  name?: string;
  provider: string;
}

interface ParsedContact {
  phoneNumber: string;
  firstName: string;
  lastName?: string;
  email?: string;
  timezone?: string;
  areaCode?: string;
  customFields: Record<string, string>;
  rowNumber: number;
  isValid: boolean;
  validationErrors: string[];
}

interface Schedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  isEnabled: boolean;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
];

function WizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('id');

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic Info
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState('');

  // Step 2: VAPI Connection
  const [vapiApiKey, setVapiApiKey] = useState('');
  const [vapiConnected, setVapiConnected] = useState(false);
  const [vapiTesting, setVapiTesting] = useState(false);
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState('');

  // Step 3: Phone Number
  const [phoneNumbers, setPhoneNumbers] = useState<VapiPhoneNumber[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState('');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');

  // Step 4: Contacts
  const [uploadStep, setUploadStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [invalidContacts, setInvalidContacts] = useState<ParsedContact[]>([]);
  const [duplicateContacts, setDuplicateContacts] = useState<ParsedContact[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Step 5: Scheduling
  const [schedules, setSchedules] = useState<Schedule[]>(
    DAYS_OF_WEEK.map((_, i) => ({
      dayOfWeek: i,
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'America/New_York',
      isEnabled: i >= 1 && i <= 5, // Mon-Fri enabled by default
    }))
  );
  const [maxConcurrentCalls, setMaxConcurrentCalls] = useState(10);
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelayHours, setRetryDelayHours] = useState(4);

  // Step 6: SMS Triggers
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [twilioTesting, setTwilioTesting] = useState(false);
  const [twilioConnected, setTwilioConnected] = useState(false);

  // Campaign ID for draft saving
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(campaignId);

  // Load organizations on mount
  useEffect(() => {
    fetchOrganizations();
  }, []);

  // Load existing campaign if resuming
  useEffect(() => {
    if (campaignId) {
      loadCampaign(campaignId);
    }
  }, [campaignId]);

  async function fetchOrganizations() {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  }

  async function loadCampaign(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/outbound-campaigns/${id}`);
      if (response.ok) {
        const data = await response.json();
        const campaign = data.campaign;

        setName(campaign.name || '');
        setDescription(campaign.description || '');
        setOrganizationId(campaign.organizationId || '');
        setSelectedAssistantId(campaign.vapiAssistantId || '');
        setSelectedPhoneNumberId(campaign.vapiPhoneNumberId || '');
        setSelectedPhoneNumber(campaign.vapiPhoneNumber || '');
        setTwilioPhoneNumber(campaign.twilioPhoneNumber || '');
        setMaxConcurrentCalls(campaign.maxConcurrentCalls || 10);
        setMaxRetries(campaign.maxRetries || 3);
        setRetryDelayHours(campaign.retryDelayHours || 4);
        setCurrentStep(campaign.currentStep || 1);

        if (data.schedules && data.schedules.length > 0) {
          const loadedSchedules = DAYS_OF_WEEK.map((_, i) => {
            const existing = data.schedules.find((s: Schedule) => s.dayOfWeek === i);
            return existing || {
              dayOfWeek: i,
              startTime: '09:00',
              endTime: '17:00',
              timezone: 'America/New_York',
              isEnabled: false,
            };
          });
          setSchedules(loadedSchedules);
        }
      }
    } catch (error) {
      console.error('Error loading campaign:', error);
    } finally {
      setLoading(false);
    }
  }

  const saveDraft = useCallback(async (step: number) => {
    setSaving(true);
    setError(null);

    try {
      if (!savedCampaignId) {
        // Create new campaign
        const response = await fetch('/api/outbound-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name || 'Untitled Campaign',
            description,
            organizationId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create campaign');
        }

        const data = await response.json();
        setSavedCampaignId(data.campaign.id);
        router.replace(`/admin/outbound-campaigns/new?id=${data.campaign.id}`);
      } else {
        // Update existing campaign
        const updates: Record<string, unknown> = {
          currentStep: step,
        };

        if (step >= 1) {
          updates.name = name;
          updates.description = description;
        }

        if (step >= 2) {
          updates.vapiAssistantId = selectedAssistantId;
        }

        if (step >= 3) {
          updates.vapiPhoneNumberId = selectedPhoneNumberId;
          updates.vapiPhoneNumber = selectedPhoneNumber;
        }

        if (step >= 5) {
          updates.maxConcurrentCalls = maxConcurrentCalls;
          updates.maxRetries = maxRetries;
          updates.retryDelayHours = retryDelayHours;
        }

        if (step >= 6) {
          updates.twilioPhoneNumber = twilioPhoneNumber;
        }

        const response = await fetch(`/api/outbound-campaigns/${savedCampaignId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to save campaign');
        }

        // Save schedules at step 5
        if (step >= 5) {
          await fetch(`/api/outbound-campaigns/${savedCampaignId}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schedules: schedules.filter((s) => s.isEnabled),
            }),
          });
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [
    savedCampaignId, name, description, organizationId, selectedAssistantId,
    selectedPhoneNumberId, selectedPhoneNumber, maxConcurrentCalls, maxRetries,
    retryDelayHours, twilioPhoneNumber, schedules, router
  ]);

  async function testVapiConnection() {
    if (!vapiApiKey) return;

    setVapiTesting(true);
    setError(null);

    try {
      const response = await fetch('/api/vapi/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: vapiApiKey }),
      });

      const data = await response.json();

      if (data.success) {
        setVapiConnected(true);

        // Fetch assistants
        const assistantsRes = await fetch('/api/vapi/assistants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: vapiApiKey }),
        });

        if (assistantsRes.ok) {
          const assistantsData = await assistantsRes.json();
          setAssistants(assistantsData.assistants || []);
        }

        // Fetch phone numbers
        const phoneRes = await fetch('/api/vapi/phone-numbers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: vapiApiKey }),
        });

        if (phoneRes.ok) {
          const phoneData = await phoneRes.json();
          setPhoneNumbers(phoneData.phoneNumbers || []);
        }
      } else {
        setError(data.message || 'Failed to connect to VAPI');
      }
    } catch (error) {
      setError('Failed to test VAPI connection');
    } finally {
      setVapiTesting(false);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `/api/outbound-campaigns/${savedCampaignId}/contacts/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      if (data.step === 'mapping') {
        setFileHeaders(data.headers);
        setSampleRows(data.sampleRows);
        setFieldMapping(data.suggestedMapping || {});
        setUploadStep('mapping');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  async function applyFieldMapping() {
    if (!fieldMapping.phoneNumber || !fieldMapping.firstName) {
      setError('Phone number and first name mappings are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      // Re-upload with mapping
      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      if (!fileInput?.files?.[0]) {
        throw new Error('Please re-select the file');
      }

      formData.append('file', fileInput.files[0]);
      formData.append('mapping', JSON.stringify(fieldMapping));

      const response = await fetch(
        `/api/outbound-campaigns/${savedCampaignId}/contacts/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      setParsedContacts(data.contacts || []);
      setInvalidContacts(data.invalidPreview || []);
      setDuplicateContacts(data.duplicatePreview || []);
      setUploadStep('preview');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setLoading(false);
    }
  }

  async function importContacts() {
    if (parsedContacts.length === 0) return;

    setLoading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const response = await fetch(
        `/api/outbound-campaigns/${savedCampaignId}/contacts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: parsedContacts }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setUploadProgress(100);
      // Move to next step after successful import
      setTimeout(() => {
        setCurrentStep(5);
        saveDraft(5);
      }, 500);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  async function finishWizard() {
    setSaving(true);
    setError(null);

    try {
      // Mark wizard as complete
      const response = await fetch(`/api/outbound-campaigns/${savedCampaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isWizardComplete: true,
          currentStep: 7,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete setup');
      }

      router.push(`/admin/outbound-campaigns/${savedCampaignId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to complete setup');
    } finally {
      setSaving(false);
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return name.trim() && organizationId;
      case 2:
        return vapiConnected && selectedAssistantId;
      case 3:
        return selectedPhoneNumberId;
      case 4:
        return parsedContacts.length > 0 || uploadStep !== 'preview';
      case 5:
        return schedules.some((s) => s.isEnabled);
      case 6:
        return true; // SMS is optional
      case 7:
        return true;
      default:
        return false;
    }
  };

  const nextStep = async () => {
    if (currentStep < 7) {
      await saveDraft(currentStep + 1);
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (loading && !savedCampaignId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[
          { num: 1, label: 'Campaign Info', icon: FileText },
          { num: 2, label: 'VAPI Assistant', icon: Phone },
          { num: 3, label: 'Phone Number', icon: Phone },
          { num: 4, label: 'Contacts', icon: Upload },
          { num: 5, label: 'Schedule', icon: Calendar },
          { num: 6, label: 'SMS Triggers', icon: MessageSquare },
          { num: 7, label: 'Review', icon: Check },
        ].map((step) => (
          <div
            key={step.num}
            className={`flex flex-col items-center ${
              currentStep >= step.num ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                currentStep > step.num
                  ? 'bg-primary border-primary text-primary-foreground'
                  : currentStep === step.num
                  ? 'border-primary text-primary'
                  : 'border-muted text-muted-foreground'
              }`}
            >
              {currentStep > step.num ? (
                <Check className="h-5 w-5" />
              ) : (
                <step.icon className="h-5 w-5" />
              )}
            </div>
            <span className="text-xs mt-1 hidden md:block">{step.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === 1 && 'Campaign Information'}
            {currentStep === 2 && 'Connect VAPI & Select Assistant'}
            {currentStep === 3 && 'Select Phone Number'}
            {currentStep === 4 && 'Upload Contacts'}
            {currentStep === 5 && 'Call Schedule'}
            {currentStep === 6 && 'SMS Triggers (Optional)'}
            {currentStep === 7 && 'Review & Launch'}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && 'Enter basic campaign details and select a client'}
            {currentStep === 2 && 'Enter your VAPI API key and select an AI assistant'}
            {currentStep === 3 && 'Choose which phone number to use for outbound calls'}
            {currentStep === 4 && 'Upload your contact list (CSV or Excel)'}
            {currentStep === 5 && 'Set calling hours and retry settings'}
            {currentStep === 6 && 'Configure automated SMS follow-ups'}
            {currentStep === 7 && 'Review your campaign settings before launching'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="organization">Client *</Label>
                <Select value={organizationId} onValueChange={setOrganizationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Q1 Sales Outreach"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the campaign purpose"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Step 2: VAPI Connection */}
          {currentStep === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="vapiKey">VAPI Private API Key *</Label>
                <div className="flex gap-2">
                  <Input
                    id="vapiKey"
                    type="password"
                    value={vapiApiKey}
                    onChange={(e) => setVapiApiKey(e.target.value)}
                    placeholder="Enter your VAPI private API key"
                    className="flex-1"
                  />
                  <Button
                    onClick={testVapiConnection}
                    disabled={!vapiApiKey || vapiTesting}
                  >
                    {vapiTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : vapiConnected ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      'Test'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your API key is not stored and must be entered each session
                </p>
              </div>

              {vapiConnected && assistants.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Assistant *</Label>
                  <div className="grid gap-2">
                    {assistants.map((assistant) => (
                      <div
                        key={assistant.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedAssistantId === assistant.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-muted-foreground'
                        }`}
                        onClick={() => setSelectedAssistantId(assistant.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{assistant.name}</h4>
                            {assistant.model && (
                              <p className="text-xs text-muted-foreground">
                                {assistant.model.provider} / {assistant.model.model}
                              </p>
                            )}
                          </div>
                          {selectedAssistantId === assistant.id && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        {assistant.firstMessage && (
                          <p className="text-sm text-muted-foreground mt-2 truncate">
                            &quot;{assistant.firstMessage}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {vapiConnected && assistants.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No assistants found in your VAPI account. Please create an assistant first.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Step 3: Phone Number */}
          {currentStep === 3 && (
            <>
              {phoneNumbers.length > 0 ? (
                <div className="space-y-2">
                  <Label>Select Phone Number *</Label>
                  <div className="grid gap-2">
                    {phoneNumbers.map((phone) => (
                      <div
                        key={phone.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedPhoneNumberId === phone.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-muted-foreground'
                        }`}
                        onClick={() => {
                          setSelectedPhoneNumberId(phone.id);
                          setSelectedPhoneNumber(phone.number);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium font-mono">{phone.number}</h4>
                            <p className="text-xs text-muted-foreground">
                              {phone.name || phone.provider}
                            </p>
                          </div>
                          {selectedPhoneNumberId === phone.id && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No phone numbers found. Please go back and test your VAPI connection.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Step 4: Contacts */}
          {currentStep === 4 && (
            <>
              {uploadStep === 'upload' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 font-semibold">Upload Contact List</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      CSV or Excel file with phone numbers and names
                    </p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="mt-4"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required columns: Phone Number, First Name. Optional: Last Name, Email, and custom fields.
                  </p>
                </div>
              )}

              {uploadStep === 'mapping' && (
                <div className="space-y-4">
                  <h4 className="font-medium">Map Your Fields</h4>
                  <p className="text-sm text-muted-foreground">
                    Match your file columns to contact fields
                  </p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <Select
                        value={fieldMapping.phoneNumber || ''}
                        onValueChange={(v) =>
                          setFieldMapping({ ...fieldMapping, phoneNumber: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {fileHeaders.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>First Name *</Label>
                      <Select
                        value={fieldMapping.firstName || ''}
                        onValueChange={(v) =>
                          setFieldMapping({ ...fieldMapping, firstName: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {fileHeaders.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Select
                        value={fieldMapping.lastName || ''}
                        onValueChange={(v) =>
                          setFieldMapping({ ...fieldMapping, lastName: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {fileHeaders.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Select
                        value={fieldMapping.email || ''}
                        onValueChange={(v) =>
                          setFieldMapping({ ...fieldMapping, email: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {fileHeaders.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {sampleRows.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-sm font-medium mb-2">Preview (first 5 rows)</h5>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {fileHeaders.map((h) => (
                                <TableHead key={h}>{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sampleRows.map((row, i) => (
                              <TableRow key={i}>
                                {fileHeaders.map((h) => (
                                  <TableCell key={h}>{row[h]}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <Button onClick={applyFieldMapping} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Process Contacts
                  </Button>
                </div>
              )}

              {uploadStep === 'preview' && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="text-2xl font-bold">{parsedContacts.length}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Valid Contacts</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span className="text-2xl font-bold">{invalidContacts.length}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Invalid</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                          <span className="text-2xl font-bold">{duplicateContacts.length}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Duplicates</p>
                      </CardContent>
                    </Card>
                  </div>

                  {parsedContacts.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium mb-2">Valid Contacts (showing first 10)</h5>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Phone</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Timezone</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedContacts.slice(0, 10).map((c, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{c.phoneNumber}</TableCell>
                              <TableCell>
                                {c.firstName} {c.lastName}
                              </TableCell>
                              <TableCell>
                                {c.timezone ? (
                                  <Badge variant="secondary">{c.timezone.split('/')[1]}</Badge>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {uploadProgress > 0 && (
                    <div className="space-y-2">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        Importing contacts... {uploadProgress}%
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUploadStep('upload');
                        setParsedContacts([]);
                        setInvalidContacts([]);
                        setDuplicateContacts([]);
                      }}
                    >
                      Upload Different File
                    </Button>
                    <Button onClick={importContacts} disabled={loading || parsedContacts.length === 0}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Import {parsedContacts.length} Contacts
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 5: Scheduling */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Calling Hours</h4>
                <p className="text-sm text-muted-foreground">
                  Set when calls can be made. Times are enforced per contact&apos;s timezone.
                </p>

                {schedules.map((schedule, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-4 p-3 rounded-lg ${
                      schedule.isEnabled ? 'bg-muted/50' : 'opacity-50'
                    }`}
                  >
                    <Checkbox
                      checked={schedule.isEnabled}
                      onCheckedChange={(checked) => {
                        const newSchedules = [...schedules];
                        newSchedules[index].isEnabled = checked as boolean;
                        setSchedules(newSchedules);
                      }}
                    />
                    <span className="w-24 font-medium">{DAYS_OF_WEEK[index]}</span>
                    <Input
                      type="time"
                      value={schedule.startTime}
                      onChange={(e) => {
                        const newSchedules = [...schedules];
                        newSchedules[index].startTime = e.target.value;
                        setSchedules(newSchedules);
                      }}
                      className="w-32"
                      disabled={!schedule.isEnabled}
                    />
                    <span>to</span>
                    <Input
                      type="time"
                      value={schedule.endTime}
                      onChange={(e) => {
                        const newSchedules = [...schedules];
                        newSchedules[index].endTime = e.target.value;
                        setSchedules(newSchedules);
                      }}
                      className="w-32"
                      disabled={!schedule.isEnabled}
                    />
                    <Select
                      value={schedule.timezone}
                      onValueChange={(v) => {
                        const newSchedules = [...schedules];
                        newSchedules[index].timezone = v;
                        setSchedules(newSchedules);
                      }}
                      disabled={!schedule.isEnabled}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
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
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Max Concurrent Calls</Label>
                  <Input
                    type="number"
                    value={maxConcurrentCalls}
                    onChange={(e) => setMaxConcurrentCalls(parseInt(e.target.value) || 10)}
                    min={1}
                    max={50}
                  />
                  <p className="text-xs text-muted-foreground">
                    How many calls can run at once
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Max Retries</Label>
                  <Input
                    type="number"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(parseInt(e.target.value) || 3)}
                    min={0}
                    max={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    Retry attempts for unanswered calls
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Retry Delay (hours)</Label>
                  <Input
                    type="number"
                    value={retryDelayHours}
                    onChange={(e) => setRetryDelayHours(parseInt(e.target.value) || 4)}
                    min={1}
                    max={72}
                  />
                  <p className="text-xs text-muted-foreground">
                    Hours between retry attempts
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: SMS Triggers */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription>
                  SMS triggers will send automated text messages based on call outcomes.
                  This uses the Twilio credentials from your environment settings.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="twilioPhone">Twilio Phone Number for SMS</Label>
                <Input
                  id="twilioPhone"
                  value={twilioPhoneNumber}
                  onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                />
                <p className="text-xs text-muted-foreground">
                  The phone number to send SMS from. Leave empty to skip SMS triggers.
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                You can configure SMS triggers after the campaign is created from the campaign detail page.
              </p>
            </div>
          )}

          {/* Step 7: Review */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Campaign Name</Label>
                  <p className="font-medium">{name}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground">Client</Label>
                  <p className="font-medium">
                    {organizations.find((o) => o.id === organizationId)?.name || '-'}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground">VAPI Assistant</Label>
                  <p className="font-medium">
                    {assistants.find((a) => a.id === selectedAssistantId)?.name || selectedAssistantId}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground">Phone Number</Label>
                  <p className="font-medium font-mono">{selectedPhoneNumber || '-'}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground">Contacts</Label>
                  <p className="font-medium">{parsedContacts.length} contacts uploaded</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground">Calling Days</Label>
                  <p className="font-medium">
                    {schedules
                      .filter((s) => s.isEnabled)
                      .map((s) => DAYS_OF_WEEK[s.dayOfWeek].slice(0, 3))
                      .join(', ') || 'None'}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground">Max Concurrent Calls</Label>
                  <p className="font-medium">{maxConcurrentCalls}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground">Retry Settings</Label>
                  <p className="font-medium">
                    {maxRetries} retries, {retryDelayHours}h delay
                  </p>
                </div>
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your campaign is ready! Click &quot;Create Campaign&quot; to save and view the campaign
                  dashboard. You can start the campaign from there.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-sm text-muted-foreground flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Saving...
            </span>
          )}

          {currentStep < 7 ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed() || saving}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finishWizard} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Create Campaign
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewOutboundCampaignPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WizardContent />
    </Suspense>
  );
}
