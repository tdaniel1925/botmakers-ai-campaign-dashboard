'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  BarChart3,
  Phone,
  MessageSquare,
  Clock,
  TrendingUp,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Metrics {
  totalInteractions: number;
  completedCalls: number;
  failedCalls: number;
  smsSent: number;
  avgCallDuration: number;
  completionRate: number;
  thisWeek: number;
  thisMonth: number;
}

export default function ClientMetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true);
      try {
        // Fetch interactions to calculate metrics
        const response = await fetch('/api/interactions?limit=1000');
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch metrics');
        }

        const interactions = result.data || [];
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const completed = interactions.filter((i: { callStatus: string }) => i.callStatus === 'completed').length;
        const failed = interactions.filter((i: { callStatus: string }) => ['failed', 'no_answer', 'busy'].includes(i.callStatus)).length;
        const totalDuration = interactions.reduce((sum: number, i: { durationSeconds: number | null }) => sum + (i.durationSeconds || 0), 0);

        setMetrics({
          totalInteractions: interactions.length,
          completedCalls: completed,
          failedCalls: failed,
          smsSent: 0, // Would need separate SMS query
          avgCallDuration: interactions.length > 0 ? Math.round(totalDuration / interactions.length) : 0,
          completionRate: interactions.length > 0 ? Math.round((completed / interactions.length) * 100) : 0,
          thisWeek: interactions.filter((i: { createdAt: string }) => new Date(i.createdAt) >= weekAgo).length,
          thisMonth: interactions.filter((i: { createdAt: string }) => new Date(i.createdAt) >= monthAgo).length,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to fetch metrics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account Metrics</h1>
        <p className="text-muted-foreground">
          Performance metrics and analytics for your campaigns
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalInteractions || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.thisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.completionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Successful calls</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor((metrics?.avgCallDuration || 0) / 60)}m {(metrics?.avgCallDuration || 0) % 60}s
            </div>
            <p className="text-xs text-muted-foreground">Per call</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Performance
            </CardTitle>
            <CardDescription>
              Breakdown of call outcomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Completed</span>
                </div>
                <Badge variant="outline" className="bg-green-50">
                  {metrics?.completedCalls || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>Failed / No Answer</span>
                </div>
                <Badge variant="outline" className="bg-red-50">
                  {metrics?.failedCalls || 0}
                </Badge>
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Success Rate</span>
                  <span className="text-lg font-bold text-green-600">
                    {metrics?.completionRate || 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMS Activity
            </CardTitle>
            <CardDescription>
              Automated SMS messages sent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Messages Sent</span>
                <Badge variant="outline">{metrics?.smsSent || 0}</Badge>
              </div>
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  SMS messages are automatically sent based on detected caller intent.
                  Configure triggers in your campaign settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time-based Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Activity Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border p-4 text-center">
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-3xl font-bold">
                {metrics?.thisWeek ? Math.round(metrics.thisWeek / 7) : 0}
              </p>
              <p className="text-xs text-muted-foreground">avg daily</p>
            </div>
            <div className="rounded-md border p-4 text-center">
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-3xl font-bold">{metrics?.thisWeek || 0}</p>
              <p className="text-xs text-muted-foreground">interactions</p>
            </div>
            <div className="rounded-md border p-4 text-center">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-3xl font-bold">{metrics?.thisMonth || 0}</p>
              <p className="text-xs text-muted-foreground">interactions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
