'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Globe,
  Flag,
  Clock,
  Calendar,
  Building2,
  Megaphone,
  PlayCircle,
  Copy,
  Loader2,
  User,
  Bot,
  Send,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import type { Interaction, Campaign, Organization, Contact, SmsLog, SmsTrigger } from '@/db/schema';
import Link from 'next/link';
import { formatDateTime, formatDuration, formatPhoneNumber } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

type SmsLogWithTrigger = SmsLog & {
  trigger: SmsTrigger | null;
};

type InteractionDetail = Interaction & {
  campaign: Campaign & {
    organization: Organization;
  };
  contact: Contact | null;
  smsLogs: SmsLogWithTrigger[];
};

export default function InteractionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [interaction, setInteraction] = useState<InteractionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInteraction = useCallback(async () => {
    try {
      const response = await fetch(`/api/interactions/${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch interaction');
      }

      setInteraction(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch interaction');
      router.push('/admin/interactions');
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchInteraction();
  }, [fetchInteraction]);

  const handleToggleFlag = async () => {
    if (!interaction) return;

    try {
      const response = await fetch(`/api/interactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagged: !interaction.flagged }),
      });

      if (!response.ok) {
        throw new Error('Failed to update flag');
      }

      toast.success(interaction.flagged ? 'Flag removed' : 'Flagged for review');
      fetchInteraction();
    } catch (error) {
      toast.error('Failed to update flag');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'phone':
        return <Phone className="h-5 w-5" />;
      case 'sms':
        return <MessageSquare className="h-5 w-5" />;
      default:
        return <Globe className="h-5 w-5" />;
    }
  };

  const getStatusVariant = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getSmsStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'sent':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!interaction) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/interactions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Interactions
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
            interaction.callStatus === 'completed' ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {getSourceIcon(interaction.sourceType)}
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {interaction.phoneNumber
                ? formatPhoneNumber(interaction.phoneNumber)
                : 'Unknown Caller'}
              {interaction.flagged && (
                <Flag className="h-5 w-5 text-amber-500" fill="currentColor" />
              )}
            </h1>
            <p className="text-muted-foreground">
              Interaction #{interaction.interactionNumber} - {interaction.sourcePlatform || interaction.sourceType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={interaction.flagged ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleFlag}
          >
            <Flag className="mr-2 h-4 w-4" fill={interaction.flagged ? 'currentColor' : 'none'} />
            {interaction.flagged ? 'Flagged' : 'Flag for Review'}
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{interaction.campaign.organization?.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Campaign
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{interaction.campaign.name}</p>
            <p className="text-xs text-muted-foreground">{interaction.campaign.campaignType}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {interaction.durationSeconds
                ? formatDuration(interaction.durationSeconds)
                : 'N/A'}
            </p>
            <Badge variant={getStatusVariant(interaction.callStatus)} className="mt-1">
              {interaction.callStatus || 'pending'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{formatDateTime(interaction.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
          <TabsTrigger value="sms">
            SMS Logs
            {interaction.smsLogs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {interaction.smsLogs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="raw">Raw Payload</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Summary</CardTitle>
              <CardDescription>
                Automatically generated summary of the conversation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {interaction.aiSummary ? (
                <div className="prose prose-sm max-w-none">
                  <p>{interaction.aiSummary}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No summary available</p>
              )}
            </CardContent>
          </Card>

          {interaction.recordingUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Recording</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <audio controls className="flex-1" src={interaction.recordingUrl}>
                    Your browser does not support the audio element.
                  </audio>
                  <Button variant="outline" size="sm" asChild>
                    <a href={interaction.recordingUrl} target="_blank" rel="noopener noreferrer">
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Open
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {interaction.tags && interaction.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {interaction.tags.map((tag, i) => (
                    <Badge key={i} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transcript">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Transcript</CardTitle>
                <CardDescription>Full conversation transcript</CardDescription>
              </div>
              {interaction.transcript && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(interaction.transcript!, 'Transcript')}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {interaction.transcriptFormatted && interaction.transcriptFormatted.length > 0 ? (
                <div className="space-y-4">
                  {interaction.transcriptFormatted.map((turn, i) => (
                    <div key={i} className="flex gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                        turn.role === 'assistant' || turn.role === 'ai' || turn.role === 'agent'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {turn.role === 'assistant' || turn.role === 'ai' || turn.role === 'agent' ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-muted-foreground mb-1 capitalize">
                          {turn.role}
                        </p>
                        <p className="text-sm">{turn.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : interaction.transcript ? (
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg overflow-auto max-h-[600px]">
                  {interaction.transcript}
                </pre>
              ) : (
                <p className="text-muted-foreground">No transcript available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extracted">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Extracted Data</CardTitle>
                <CardDescription>AI-extracted structured data from the conversation</CardDescription>
              </div>
              {interaction.aiExtractedData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(
                    JSON.stringify(interaction.aiExtractedData, null, 2),
                    'Extracted data'
                  )}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy JSON
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {interaction.aiExtractedData && Object.keys(interaction.aiExtractedData).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(interaction.aiExtractedData).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-4 py-2 border-b last:border-0">
                      <span className="font-medium text-sm min-w-[150px] text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No extracted data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms">
          <Card>
            <CardHeader>
              <CardTitle>SMS Messages Sent</CardTitle>
              <CardDescription>
                SMS messages triggered by this interaction
              </CardDescription>
            </CardHeader>
            <CardContent>
              {interaction.smsLogs.length > 0 ? (
                <div className="space-y-4">
                  {interaction.smsLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getSmsStatusIcon(log.status)}
                          <Badge variant={
                            log.status === 'delivered' ? 'success' :
                            log.status === 'failed' ? 'destructive' : 'secondary'
                          }>
                            {log.status}
                          </Badge>
                          {log.trigger && (
                            <Badge variant="outline">{log.trigger.name}</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(log.sentAt)}
                        </span>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">To:</span> {formatPhoneNumber(log.toNumber)}</p>
                        <p><span className="text-muted-foreground">From:</span> {formatPhoneNumber(log.fromNumber)}</p>
                        <Separator className="my-2" />
                        <p className="bg-muted p-2 rounded">{log.message}</p>
                        {log.errorMessage && (
                          <div className="flex items-center gap-2 text-destructive text-xs mt-2">
                            <AlertCircle className="h-4 w-4" />
                            {log.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No SMS messages were sent for this interaction</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Raw Webhook Payload</CardTitle>
                <CardDescription>Original data received from the webhook</CardDescription>
              </div>
              {interaction.rawPayload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(
                    JSON.stringify(interaction.rawPayload, null, 2),
                    'Raw payload'
                  )}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy JSON
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {interaction.rawPayload ? (
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-auto max-h-[600px]">
                  {JSON.stringify(interaction.rawPayload, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">No raw payload available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
