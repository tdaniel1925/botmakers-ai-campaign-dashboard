'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  UserPlus,
  DollarSign,
  Target,
  TrendingUp,
  ArrowRight,
  Calendar,
  Clock,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import { WelcomeMessage } from '@/components/sales/welcome-message';

interface DashboardStats {
  totalLeads: number;
  newLeadsThisMonth: number;
  wonLeads: number;
  conversionRate: number;
  pendingCommissions: number;
  paidCommissions: number;
  totalEarnings: number;
  upcomingFollowUps: number;
}

interface RecentLead {
  id: string;
  leadNumber: number;
  firstName: string;
  lastName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  estimatedValue: number | null;
  createdAt: string;
  stage: { name: string; color: string } | null;
}

interface UpcomingFollowUp {
  id: string;
  leadNumber: number;
  firstName: string;
  lastName: string;
  company: string | null;
  nextFollowUpAt: string;
}

interface RecentCommission {
  id: string;
  saleAmount: number;
  commissionAmount: number;
  status: string;
  createdAt: string;
  lead: { firstName: string; lastName: string } | null;
}

interface UserProfile {
  fullName: string;
  hasSeenWelcome: boolean;
  mustChangePassword: boolean;
}

export default function SalesDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<UpcomingFollowUp[]>([]);
  const [recentCommissions, setRecentCommissions] = useState<RecentCommission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchUserProfile();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/sales/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const data = await response.json();
      setStats(data.stats);
      setRecentLeads(data.recentLeads);
      setUpcomingFollowUps(data.upcomingFollowUps);
      setRecentCommissions(data.recentCommissions);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/sales/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();
      setUserProfile({
        fullName: data.profile.fullName,
        hasSeenWelcome: data.profile.hasSeenWelcome,
        mustChangePassword: data.profile.mustChangePassword,
      });
      // Show welcome if user hasn't seen it yet
      if (!data.profile.hasSeenWelcome) {
        setShowWelcome(true);
      }
    } catch (error) {
      console.error('Failed to fetch user profile');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      new: 'default',
      contacted: 'secondary',
      qualified: 'secondary',
      proposal: 'secondary',
      negotiation: 'secondary',
      won: 'default',
      lost: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getCommissionStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      approved: 'secondary',
      paid: 'default',
      cancelled: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Message for New Users */}
      {showWelcome && userProfile && (
        <WelcomeMessage
          userName={userProfile.fullName}
          onDismiss={() => setShowWelcome(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back{userProfile ? `, ${userProfile.fullName.split(' ')[0]}` : ''}! Here&apos;s your sales overview.
          </p>
        </div>
        <Link href="/sales/leads/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add New Lead
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLeads || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{stats?.newLeadsThisMonth || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.conversionRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.wonLeads || 0} won deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency((stats?.pendingCommissions || 0) / 100)}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency((stats?.totalEarnings || 0) / 100)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency((stats?.paidCommissions || 0) / 100)} paid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Leads</CardTitle>
              <Link href="/sales/leads">
                <Button variant="ghost" size="sm">
                  View all
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <CardDescription>Your most recently added leads</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No leads yet</p>
                <Link href="/sales/leads/new">
                  <Button variant="link">Add your first lead</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentLeads.map((lead) => (
                  <Link key={lead.id} href={`/sales/leads/${lead.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {lead.firstName[0]}{lead.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {lead.firstName} {lead.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {lead.company || lead.email || 'No company'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {lead.stage && (
                          <Badge
                            variant="outline"
                            style={{ borderColor: lead.stage.color, color: lead.stage.color }}
                          >
                            {lead.stage.name}
                          </Badge>
                        )}
                        {!lead.stage && getStatusBadge(lead.status)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Follow-ups */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming Follow-ups</CardTitle>
              <Badge variant="secondary">
                {stats?.upcomingFollowUps || 0} scheduled
              </Badge>
            </div>
            <CardDescription>Leads that need your attention</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingFollowUps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No follow-ups scheduled</p>
                <p className="text-sm mt-1">Schedule follow-ups when viewing leads</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingFollowUps.map((lead) => (
                  <Link key={lead.id} href={`/sales/leads/${lead.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {lead.firstName} {lead.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {lead.company || 'No company'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium text-amber-600">
                          {formatDateTime(lead.nextFollowUpAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Commissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Commissions</CardTitle>
            <Link href="/sales/commissions">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <CardDescription>Your latest commission activity</CardDescription>
        </CardHeader>
        <CardContent>
          {recentCommissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No commissions yet</p>
              <p className="text-sm mt-1">Commissions appear when your leads convert to paying customers</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Lead</th>
                    <th className="pb-3 font-medium">Sale Amount</th>
                    <th className="pb-3 font-medium">Commission</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentCommissions.map((commission) => (
                    <tr key={commission.id} className="text-sm">
                      <td className="py-3">
                        {commission.lead
                          ? `${commission.lead.firstName} ${commission.lead.lastName}`
                          : 'N/A'}
                      </td>
                      <td className="py-3 font-medium">
                        {formatCurrency(commission.saleAmount / 100)}
                      </td>
                      <td className="py-3 font-medium text-green-600">
                        {formatCurrency(commission.commissionAmount / 100)}
                      </td>
                      <td className="py-3">
                        {getCommissionStatusBadge(commission.status)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDateTime(commission.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/sales/leads/new">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-blue-100 rounded-lg">
                <UserPlus className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Add New Lead</p>
                <p className="text-sm text-muted-foreground">Enter a new prospect</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sales/resources">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">Sales Resources</p>
                <p className="text-sm text-muted-foreground">Flyers, docs & materials</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sales/products">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold">Products & Services</p>
                <p className="text-sm text-muted-foreground">What we offer</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
