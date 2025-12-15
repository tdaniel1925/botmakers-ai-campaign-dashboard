'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  BarChart3,
  Download,
  Loader2,
  Phone,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Organization, Campaign } from '@/db/schema';
import { formatDuration } from '@/lib/utils';

interface ReportSummary {
  totalInteractions: number;
  completedCalls: number;
  totalCalls: number;
  completionRate: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  smsSent: number;
  smsDelivered: number;
  smsFailed: number;
}

interface ReportData {
  summary: ReportSummary;
  statusBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  dailyTrend: Array<{ date: string; count: number }>;
  dateRange: { start: string; end: string };
}

export default function ReportsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Filters
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', 'summary');
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      if (orgFilter !== 'all') params.set('organizationId', orgFilter);
      if (campaignFilter !== 'all') params.set('campaignId', campaignFilter);

      const response = await fetch(`/api/reports?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch report');
      }

      setReportData(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch report');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, orgFilter, campaignFilter]);

  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/organizations');
      const result = await response.json();
      if (response.ok) {
        setOrganizations(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (orgFilter !== 'all') params.set('organizationId', orgFilter);

      const response = await fetch(`/api/campaigns?${params}`);
      const result = await response.json();
      if (response.ok) {
        setCampaigns(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    }
  }, [orgFilter]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchCampaigns();
    setCampaignFilter('all');
  }, [fetchCampaigns, orgFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      if (orgFilter !== 'all') params.set('organizationId', orgFilter);
      if (campaignFilter !== 'all') params.set('campaignId', campaignFilter);

      const response = await fetch(`/api/reports/export?${params}`);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to export');
      }

      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `export.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success('Export downloaded successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export');
    } finally {
      setIsExporting(false);
    }
  };

  const maxDailyCount = Math.max(...(reportData?.dailyTrend.map(d => d.count) || [1]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Analytics and reporting for all campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('json')}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export JSON
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reportData ? (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.summary.totalInteractions}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.summary.completionRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {reportData.summary.completedCalls} of {reportData.summary.totalCalls} calls
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(reportData.summary.avgDurationSeconds)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: {formatDuration(reportData.summary.totalDurationSeconds)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">SMS Sent</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.summary.smsSent}</div>
                <p className="text-xs text-muted-foreground">
                  {reportData.summary.smsDelivered} delivered, {reportData.summary.smsFailed} failed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Status Breakdown</CardTitle>
                <CardDescription>Distribution of call statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(reportData.statusBreakdown).map(([status, count]) => {
                    const total = reportData.summary.totalInteractions;
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{status || 'pending'}</span>
                          <span className="text-muted-foreground">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              status === 'completed' ? 'bg-green-500' :
                              status === 'failed' ? 'bg-red-500' :
                              'bg-gray-400'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Source Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Source Breakdown</CardTitle>
                <CardDescription>Distribution of interaction sources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(reportData.sourceBreakdown).map(([source, count]) => {
                    const total = reportData.summary.totalInteractions;
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={source} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{source.replace('_', ' ')}</span>
                          <span className="text-muted-foreground">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              source === 'phone' ? 'bg-blue-500' :
                              source === 'sms' ? 'bg-purple-500' :
                              source === 'web_form' ? 'bg-green-500' :
                              'bg-orange-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Trend</CardTitle>
              <CardDescription>Interactions over time</CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.dailyTrend.length > 0 ? (
                <div className="h-[200px] flex items-end gap-1">
                  {reportData.dailyTrend.map((day) => {
                    const height = maxDailyCount > 0 ? (day.count / maxDailyCount) * 100 : 0;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 group relative"
                      >
                        <div
                          className="bg-primary rounded-t transition-all hover:bg-primary/80"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                          <div className="bg-popover text-popover-foreground text-xs rounded px-2 py-1 shadow-md whitespace-nowrap">
                            <p className="font-medium">{day.count} interactions</p>
                            <p className="text-muted-foreground">{day.date}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  No data for the selected period
                </div>
              )}
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{startDate}</span>
                <span>{endDate}</span>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No data available</h3>
          <p className="text-muted-foreground">
            Adjust your filters to see report data.
          </p>
        </div>
      )}
    </div>
  );
}
