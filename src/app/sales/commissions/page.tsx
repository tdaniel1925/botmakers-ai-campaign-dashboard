'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Loader2,
  Calendar,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime, formatCurrency } from '@/lib/utils';

interface Commission {
  id: string;
  leadId: string | null;
  saleAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  lead: {
    firstName: string;
    lastName: string;
    company: string | null;
  } | null;
}

interface Stats {
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
  totalEarnings: number;
  totalSales: number;
  commissionCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchCommissions();
  }, [statusFilter, startDate, endDate, currentPage]);

  const fetchCommissions = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/sales/commissions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch commissions');

      const data = await response.json();
      setCommissions(data.commissions);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to load commissions');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
      pending: { variant: 'outline', icon: Clock },
      approved: { variant: 'secondary', icon: CheckCircle2 },
      paid: { variant: 'default', icon: Wallet },
      cancelled: { variant: 'destructive', icon: Clock },
    };
    const { variant, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant={variant} className="capitalize gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const exportToCSV = () => {
    if (commissions.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Date', 'Lead', 'Company', 'Sale Amount', 'Commission Rate', 'Commission Amount', 'Status', 'Paid At'];
    const rows = commissions.map((c) => [
      new Date(c.createdAt).toLocaleDateString(),
      c.lead ? `${c.lead.firstName} ${c.lead.lastName}` : 'N/A',
      c.lead?.company || 'N/A',
      (c.saleAmount / 100).toFixed(2),
      `${c.commissionRate}%`,
      (c.commissionAmount / 100).toFixed(2),
      c.status,
      c.paidAt ? new Date(c.paidAt).toLocaleDateString() : '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export downloaded');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Commissions</h1>
          <p className="text-muted-foreground">
            Track your sales commissions and earnings
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency((stats?.totalPending || 0) / 100)}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency((stats?.totalApproved || 0) / 100)}
            </div>
            <p className="text-xs text-muted-foreground">Ready for payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <Wallet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency((stats?.totalPaid || 0) / 100)}
            </div>
            <p className="text-xs text-muted-foreground">Total received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency((stats?.totalSales || 0) / 100)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.commissionCount || 0} transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
          <CardDescription>
            Your complete commission transaction history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : commissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No commissions found</p>
              <p className="text-sm mt-1">
                Commissions appear when your leads convert to paying customers
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Lead</th>
                      <th className="pb-3 font-medium">Company</th>
                      <th className="pb-3 font-medium text-right">Sale Amount</th>
                      <th className="pb-3 font-medium text-center">Rate</th>
                      <th className="pb-3 font-medium text-right">Commission</th>
                      <th className="pb-3 font-medium text-center">Status</th>
                      <th className="pb-3 font-medium">Paid At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {commissions.map((commission) => (
                      <tr key={commission.id} className="text-sm">
                        <td className="py-3">
                          {formatDateTime(commission.createdAt)}
                        </td>
                        <td className="py-3 font-medium">
                          {commission.lead
                            ? `${commission.lead.firstName} ${commission.lead.lastName}`
                            : 'N/A'}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {commission.lead?.company || '-'}
                        </td>
                        <td className="py-3 text-right font-medium">
                          {formatCurrency(commission.saleAmount / 100)}
                        </td>
                        <td className="py-3 text-center">
                          {commission.commissionRate}%
                        </td>
                        <td className="py-3 text-right font-medium text-green-600">
                          {formatCurrency(commission.commissionAmount / 100)}
                        </td>
                        <td className="py-3 text-center">
                          {getStatusBadge(commission.status)}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {commission.paidAt
                            ? formatDateTime(commission.paidAt)
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} commissions
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={currentPage === pagination.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Commission Rate Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-blue-900">Your Commission Rate: 18%</p>
              <p className="text-sm text-blue-700">
                You earn 18% commission on every sale from your referred leads
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
