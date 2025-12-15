'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Globe,
  Clock,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  PhoneOff,
  Loader2,
  Copy,
  BarChart3,
  PhoneCall,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Campaign, Organization, Interaction } from '@/db/schema';
import { formatDateTime, formatDuration, formatPhoneNumber } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CampaignStats {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  noAnswerCalls: number;
  avgDuration: number;
  totalDuration: number;
  successRate: number;
  webhookErrors: number;
}

interface CallsByDay {
  date: string;
  count: number;
  completed: number;
}

interface CallsByStatus {
  status: string;
  count: number;
}

interface CallsBySource {
  sourceType: string;
  count: number;
}

interface StatsResponse {
  campaign: Campaign & { organization: Organization };
  stats: CampaignStats;
  callsByDay: CallsByDay[];
  callsByStatus: CallsByStatus[];
  callsBySource: CallsBySource[];
}

interface InteractionWithCampaign extends Interaction {
  campaign: Campaign & { organization: Organization };
}

// Generate a short readable call ID
function generateCallId(interactionNumber: number): string {
  return `CALL-${String(interactionNumber).padStart(4, '0')}`;
}

export default function ClientCampaignDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [statsData, setStatsData] = useState<StatsResponse | null>(null);

  // Calls tab state
  const [calls, setCalls] = useState<InteractionWithCampaign[]>([]);
  const [callsPage, setCallsPage] = useState(1);
  const [callsTotal, setCallsTotal] = useState(0);
  const [callsLoading, setCallsLoading] = useState(false);

  const limit = 20;

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${id}/stats`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch stats');
      }

      setStatsData(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch campaign');
      router.push('/dashboard/campaigns');
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  const fetchCalls = useCallback(async (page: number) => {
    setCallsLoading(true);
    try {
      const response = await fetch(
        `/api/interactions?campaignId=${id}&page=${page}&limit=${limit}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch calls');
      }

      setCalls(result.data);
      setCallsTotal(result.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch calls');
    } finally {
      setCallsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchCalls(callsPage);
  }, [fetchCalls, callsPage]);

  const copyWebhookUrl = () => {
    if (!statsData?.campaign) return;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const url = `${baseUrl}/api/webhook/${statsData.campaign.webhookUuid}`;
    navigator.clipboard.writeText(url);
    toast.success('Webhook URL copied to clipboard');
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'no_answer':
        return <PhoneOff className="h-4 w-4 text-amber-500" />;
      case 'busy':
        return <Phone className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    const variants: Record<string, 'default' | 'success' | 'destructive' | 'secondary' | 'outline'> = {
      completed: 'success',
      failed: 'destructive',
      no_answer: 'secondary',
      busy: 'outline',
    };
    return (
      <Badge variant={variants[status || ''] || 'secondary'}>
        {status || 'pending'}
      </Badge>
    );
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'phone':
        return <Phone className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!statsData) {
    return null;
  }

  const { campaign, stats, callsByDay, callsByStatus, callsBySource } = statsData;
  const callsPageCount = Math.ceil(callsTotal / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/campaigns">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-muted-foreground">{campaign.campaignType}</p>
          {campaign.description && (
            <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={campaign.isActive ? 'success' : 'secondary'}>
            {campaign.isActive ? 'Active' : 'Inactive'}
          </Badge>
          <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Webhook URL
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PhoneCall className="h-4 w-4" />
              Total Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalCalls}</p>
            <p className="text-xs text-muted-foreground">
              {stats.completedCalls} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.successRate}%</p>
            <p className="text-xs text-muted-foreground">
              {stats.failedCalls} failed, {stats.noAnswerCalls} no answer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</p>
            <p className="text-xs text-muted-foreground">
              {formatDuration(stats.totalDuration)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Since
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
            <p className="text-xs text-muted-foreground">
              Campaign started
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="calls">
            <PhoneCall className="mr-2 h-4 w-4" />
            Calls
            {callsTotal > 0 && (
              <Badge variant="secondary" className="ml-2">{callsTotal}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Calls by Status */}
            <Card>
              <CardHeader>
                <CardTitle>Calls by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {callsByStatus.length > 0 ? (
                  <div className="space-y-3">
                    {callsByStatus.map((item) => (
                      <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <span className="capitalize">{item.status || 'pending'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.count}</span>
                          <span className="text-muted-foreground text-sm">
                            ({stats.totalCalls > 0 ? Math.round((item.count / stats.totalCalls) * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No calls yet</p>
                )}
              </CardContent>
            </Card>

            {/* Calls by Source */}
            <Card>
              <CardHeader>
                <CardTitle>Calls by Source</CardTitle>
              </CardHeader>
              <CardContent>
                {callsBySource.length > 0 ? (
                  <div className="space-y-3">
                    {callsBySource.map((item) => (
                      <div key={item.sourceType} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getSourceIcon(item.sourceType)}
                          <span className="capitalize">{item.sourceType}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.count}</span>
                          <span className="text-muted-foreground text-sm">
                            ({stats.totalCalls > 0 ? Math.round((item.count / stats.totalCalls) * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No calls yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Calls by Day Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Calls Over Time (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {callsByDay.length > 0 ? (
                <div className="h-[200px] flex items-end gap-1">
                  {callsByDay.map((day) => {
                    const maxCount = Math.max(...callsByDay.map(d => d.count), 1);
                    const height = (day.count / maxCount) * 100;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 group relative"
                        title={`${new Date(day.date).toLocaleDateString()}: ${day.count} calls`}
                      >
                        <div
                          className="bg-primary/80 hover:bg-primary rounded-t transition-colors"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-popover border rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                          {new Date(day.date).toLocaleDateString()}: {day.count} calls
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No call data yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Call Log</CardTitle>
                <CardDescription>
                  All calls for this campaign
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchCalls(callsPage)}
                disabled={callsLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${callsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {callsLoading && calls.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : calls.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Call ID</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calls.map((call) => (
                        <TableRow key={call.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/interactions/${call.id}`}
                              className="text-primary hover:underline font-mono font-medium"
                            >
                              {generateCallId(call.interactionNumber)}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {call.phoneNumber
                              ? formatPhoneNumber(call.phoneNumber)
                              : 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getSourceIcon(call.sourceType)}
                              <span className="capitalize">{call.sourcePlatform || call.sourceType}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(call.callStatus)}</TableCell>
                          <TableCell>
                            {call.durationSeconds
                              ? formatDuration(call.durationSeconds)
                              : '-'}
                          </TableCell>
                          <TableCell>{formatDateTime(call.createdAt)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/interactions/${call.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {callsPageCount > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(callsPage - 1) * limit + 1} to {Math.min(callsPage * limit, callsTotal)} of {callsTotal}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCallsPage(p => Math.max(1, p - 1))}
                          disabled={callsPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                          Page {callsPage} of {callsPageCount}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCallsPage(p => Math.min(callsPageCount, p + 1))}
                          disabled={callsPage === callsPageCount}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">No calls yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
