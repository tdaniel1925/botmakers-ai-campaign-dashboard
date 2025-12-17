'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Phone,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileText,
  MessageSquare,
  Volume2,
  RefreshCw,
} from 'lucide-react';

interface OutboundCampaign {
  id: string;
  organizationId: string;
  organizationName: string | null;
  name: string;
  description: string | null;
  webhookUuid: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  vapiAssistantId: string | null;
  vapiPhoneNumberId: string | null;
  vapiPhoneNumber: string | null;
  twilioPhoneNumber: string | null;
  maxConcurrentCalls: number;
  maxRetries: number;
  retryDelayHours: number;
  totalContacts: number;
  contactsCalled: number;
  contactsAnswered: number;
  contactsFailed: number;
  currentStep: number;
  isWizardComplete: boolean;
  actualStartAt: string | null;
  completedAt: string | null;
  scheduledStartAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CallLog {
  id: string;
  contactId: string;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhoneNumber: string | null;
  vapiCallId: string | null;
  callResult: string | null;
  durationSeconds: number | null;
  attemptNumber: number;
  transcript: string | null;
  transcriptFormatted: Array<{ role: string; content: string }> | null;
  recordingUrl: string | null;
  aiSummary: string | null;
  smsSent: boolean;
  smsTriggerId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

interface ContactStat {
  status: string;
  count: number;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  running: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
};

const resultColors: Record<string, string> = {
  answered: 'bg-green-100 text-green-800',
  no_answer: 'bg-gray-100 text-gray-800',
  busy: 'bg-yellow-100 text-yellow-800',
  voicemail: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-800',
};

export default function OutboundCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [campaign, setCampaign] = useState<OutboundCampaign | null>(null);
  const [contactStats, setContactStats] = useState<ContactStat[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [resultStats, setResultStats] = useState<{ result: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchCampaign();
    fetchCallLogs();
  }, [id, resultFilter, page]);

  async function fetchCampaign() {
    try {
      const response = await fetch(`/api/outbound-campaigns/${id}`);
      if (response.ok) {
        const data = await response.json();
        setCampaign(data.campaign);
        setContactStats(data.contactStats || []);
      } else if (response.status === 404) {
        router.push('/admin/outbound-campaigns');
      }
    } catch (error) {
      console.error('Error fetching campaign:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCallLogs() {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (resultFilter !== 'all') {
        params.set('result', resultFilter);
      }

      const response = await fetch(`/api/outbound-campaigns/${id}/call-logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCallLogs(data.callLogs || []);
        setResultStats(data.stats || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching call logs:', error);
    }
  }

  async function updateCampaignStatus(newStatus: string) {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/outbound-campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchCampaign();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setActionLoading(false);
    }
  }

  function formatDuration(seconds: number | null): string {
    if (seconds === null || seconds === undefined) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Campaign not found</p>
        <Link href="/admin/outbound-campaigns">
          <Button variant="outline" className="mt-4">
            Back to Campaigns
          </Button>
        </Link>
      </div>
    );
  }

  const progressPercent = campaign.totalContacts > 0
    ? Math.round((campaign.contactsCalled / campaign.totalContacts) * 100)
    : 0;

  const answerRate = campaign.contactsCalled > 0
    ? Math.round((campaign.contactsAnswered / campaign.contactsCalled) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/outbound-campaigns">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <p className="text-muted-foreground">
              {campaign.organizationName || 'No client'} • Created{' '}
              {new Date(campaign.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={statusColors[campaign.status]}>
            {campaign.status}
          </Badge>

          {campaign.status === 'scheduled' && (
            <Button
              onClick={() => updateCampaignStatus('running')}
              disabled={actionLoading}
            >
              <Play className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}

          {campaign.status === 'running' && (
            <>
              <Button
                variant="outline"
                onClick={() => updateCampaignStatus('paused')}
                disabled={actionLoading}
              >
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
              <Button
                variant="destructive"
                onClick={() => updateCampaignStatus('cancelled')}
                disabled={actionLoading}
              >
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            </>
          )}

          {campaign.status === 'paused' && (
            <Button
              onClick={() => updateCampaignStatus('running')}
              disabled={actionLoading}
            >
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}

          {campaign.status === 'draft' && (
            <Button
              onClick={() => updateCampaignStatus('scheduled')}
              disabled={actionLoading}
            >
              <Clock className="mr-2 h-4 w-4" />
              Schedule
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.totalContacts.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calls Made</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.contactsCalled.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{progressPercent}% complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Answered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.contactsAnswered.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{answerRate}% answer rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.contactsFailed.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(campaign.totalContacts - campaign.contactsCalled).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Campaign Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{campaign.contactsCalled} called</span>
              <span>{campaign.totalContacts - campaign.contactsCalled} remaining</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="calls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calls">Call Logs</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Call Logs</CardTitle>
                  <CardDescription>
                    View call recordings, transcripts, and outcomes
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={resultFilter} onValueChange={setResultFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by result" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Results</SelectItem>
                      <SelectItem value="answered">Answered</SelectItem>
                      <SelectItem value="no_answer">No Answer</SelectItem>
                      <SelectItem value="voicemail">Voicemail</SelectItem>
                      <SelectItem value="busy">Busy</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={fetchCallLogs}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {callLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No call logs yet
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Attempt</TableHead>
                        <TableHead>SMS</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {callLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {log.contactFirstName} {log.contactLastName}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.contactPhoneNumber}
                          </TableCell>
                          <TableCell>
                            <Badge className={resultColors[log.callResult || 'pending']}>
                              {log.callResult || 'pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDuration(log.durationSeconds)}</TableCell>
                          <TableCell>{log.attemptNumber}</TableCell>
                          <TableCell>
                            {log.smsSent ? (
                              <MessageSquare className="h-4 w-4 text-green-500" />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {log.createdAt
                              ? new Date(log.createdAt).toLocaleString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedCallLog(log)}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>
                                    Call Details - {log.contactFirstName} {log.contactLastName}
                                  </DialogTitle>
                                  <DialogDescription>
                                    {log.contactPhoneNumber} • {formatDuration(log.durationSeconds)} •{' '}
                                    <Badge className={resultColors[log.callResult || 'pending']}>
                                      {log.callResult || 'pending'}
                                    </Badge>
                                  </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4">
                                  {log.aiSummary && (
                                    <div>
                                      <h4 className="font-medium mb-2">AI Summary</h4>
                                      <p className="text-sm text-muted-foreground">
                                        {log.aiSummary}
                                      </p>
                                    </div>
                                  )}

                                  {log.recordingUrl && (
                                    <div>
                                      <h4 className="font-medium mb-2">Recording</h4>
                                      <audio
                                        controls
                                        src={log.recordingUrl}
                                        className="w-full"
                                      />
                                    </div>
                                  )}

                                  {log.transcript && (
                                    <div>
                                      <h4 className="font-medium mb-2">Transcript</h4>
                                      <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                                        {log.transcriptFormatted
                                          ? log.transcriptFormatted.map((msg, i) => (
                                              <div key={i} className="mb-2">
                                                <span className="font-medium">
                                                  {msg.role === 'assistant' ? 'AI: ' : 'Customer: '}
                                                </span>
                                                {msg.content}
                                              </div>
                                            ))
                                          : log.transcript}
                                      </div>
                                    </div>
                                  )}

                                  {log.smsSent && (
                                    <div>
                                      <h4 className="font-medium mb-2">SMS Sent</h4>
                                      <Badge variant="secondary">
                                        <MessageSquare className="h-3 w-3 mr-1" />
                                        Follow-up SMS triggered
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Contact Status</CardTitle>
              <CardDescription>
                Overview of contact statuses in this campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                {contactStats.map((stat) => (
                  <div key={stat.status} className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{stat.count}</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {stat.status.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
              <CardDescription>
                Configuration details for this campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">VAPI Phone Number</h4>
                  <p className="font-mono">{campaign.vapiPhoneNumber || '-'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Twilio SMS Number</h4>
                  <p className="font-mono">{campaign.twilioPhoneNumber || '-'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Max Concurrent Calls</h4>
                  <p>{campaign.maxConcurrentCalls}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Max Retries</h4>
                  <p>{campaign.maxRetries}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Retry Delay</h4>
                  <p>{campaign.retryDelayHours} hours</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Webhook URL</h4>
                  <p className="font-mono text-xs break-all">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/{campaign.webhookUuid}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
