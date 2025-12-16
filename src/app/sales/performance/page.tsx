'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  DollarSign,
  Users,
  Target,
  Award,
  Calendar,
  BarChart3,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';

interface PerformanceData {
  monthly: {
    leads: number;
    leadsGrowth: number;
    commissions: number;
    commissionsGrowth: number;
    conversions: number;
  };
  quarterly: {
    leads: number;
    commissions: number;
    sales: number;
    conversions: number;
  };
  yearly: {
    leads: number;
    won: number;
    commissions: number;
    sales: number;
  };
  conversionRate: number;
  monthlyBreakdown: { month: string; leads: number }[];
  commissionBreakdown: { month: string; total: number }[];
  leadsByStatus: { status: string; count: number }[];
}

const statusLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-yellow-500',
  qualified: 'bg-purple-500',
  proposal: 'bg-indigo-500',
  negotiation: 'bg-orange-500',
  won: 'bg-green-500',
  lost: 'bg-red-500',
};

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPerformance();
  }, []);

  const fetchPerformance = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/sales/performance');
      if (!response.ok) throw new Error('Failed to fetch performance');
      const result = await response.json();
      setData(result);
    } catch (error) {
      toast.error('Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  };

  const GrowthIndicator = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const isPositive = value > 0;
    return (
      <span
        className={`flex items-center gap-1 text-xs ${
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load performance data
      </div>
    );
  }

  const maxLeads = Math.max(...data.monthlyBreakdown.map((m) => m.leads), 1);
  const maxCommission = Math.max(...data.commissionBreakdown.map((m) => m.total), 1);
  const totalStatusCount = data.leadsByStatus.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Performance</h1>
        <p className="text-muted-foreground">
          Track your sales performance and metrics
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">This Month</TabsTrigger>
          <TabsTrigger value="quarterly">This Quarter</TabsTrigger>
          <TabsTrigger value="yearly">This Year</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leads Added</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold">{data.monthly.leads}</div>
                  <GrowthIndicator value={data.monthly.leadsGrowth} />
                </div>
                <p className="text-xs text-muted-foreground">vs. last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.monthly.conversions}</div>
                <p className="text-xs text-muted-foreground">deals closed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commissions Earned</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(data.monthly.commissions / 100)}
                  </div>
                  <GrowthIndicator value={data.monthly.commissionsGrowth} />
                </div>
                <p className="text-xs text-muted-foreground">vs. last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.conversionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">overall</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quarterly" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leads Added</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.quarterly.leads}</div>
                <p className="text-xs text-muted-foreground">this quarter</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.quarterly.conversions}</div>
                <p className="text-xs text-muted-foreground">deals closed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.quarterly.sales / 100)}
                </div>
                <p className="text-xs text-muted-foreground">sale value</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commissions Earned</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.quarterly.commissions / 100)}
                </div>
                <p className="text-xs text-muted-foreground">this quarter</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="yearly" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.yearly.leads}</div>
                <p className="text-xs text-muted-foreground">this year</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Deals Won</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{data.yearly.won}</div>
                <p className="text-xs text-muted-foreground">closed won</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.yearly.sales / 100)}
                </div>
                <p className="text-xs text-muted-foreground">sale value</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.yearly.commissions / 100)}
                </div>
                <p className="text-xs text-muted-foreground">this year</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leads Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Leads Added (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="space-y-3">
                {data.monthlyBreakdown.map((month) => (
                  <div key={month.month} className="flex items-center gap-3">
                    <span className="text-sm w-20 text-muted-foreground">
                      {new Date(month.month + '-01').toLocaleDateString('en-US', {
                        month: 'short',
                        year: '2-digit',
                      })}
                    </span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(month.leads / maxLeads) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-10 text-right">
                      {month.leads}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Commission Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Commissions (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.commissionBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="space-y-3">
                {data.commissionBreakdown.map((month) => (
                  <div key={month.month} className="flex items-center gap-3">
                    <span className="text-sm w-20 text-muted-foreground">
                      {new Date(month.month + '-01').toLocaleDateString('en-US', {
                        month: 'short',
                        year: '2-digit',
                      })}
                    </span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${(month.total / maxCommission) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-20 text-right">
                      {formatCurrency(month.total / 100)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Status Breakdown</CardTitle>
          <CardDescription>Distribution of your leads by status</CardDescription>
        </CardHeader>
        <CardContent>
          {data.leadsByStatus.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No leads yet
            </div>
          ) : (
            <div className="space-y-4">
              {data.leadsByStatus.map((item) => {
                const percentage = totalStatusCount > 0 ? (item.count / totalStatusCount) * 100 : 0;
                return (
                  <div key={item.status} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">
                        {statusLabels[item.status] || item.status}
                      </span>
                      <span className="text-muted-foreground">
                        {item.count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          statusColors[item.status] || 'bg-gray-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
