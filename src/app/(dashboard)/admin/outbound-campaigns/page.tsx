'use client';

import { useState, useEffect } from 'react';
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
import { Phone, Plus, Users, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

interface OutboundCampaign {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  organizationId: string;
  organizationName: string | null;
  totalContacts: number;
  contactsCalled: number;
  contactsAnswered: number;
  currentStep: number;
  isWizardComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  running: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OutboundCampaignsPage() {
  const [campaigns, setCampaigns] = useState<OutboundCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      const response = await fetch('/api/outbound-campaigns');
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  const getProgressPercent = (campaign: OutboundCampaign) => {
    if (campaign.totalContacts === 0) return 0;
    return Math.round((campaign.contactsCalled / campaign.totalContacts) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outbound Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage AI-powered outbound calling campaigns
          </p>
        </div>
        <Link href="/admin/outbound-campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaigns.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.filter((c) => c.status === 'running').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.reduce((sum, c) => sum + c.totalContacts, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Answer Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const totalCalled = campaigns.reduce((sum, c) => sum + c.contactsCalled, 0);
                const totalAnswered = campaigns.reduce((sum, c) => sum + c.contactsAnswered, 0);
                return totalCalled > 0 ? `${Math.round((totalAnswered / totalCalled) * 100)}%` : '0%';
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
          <CardDescription>
            Click on a campaign to view details or continue setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-semibold">No campaigns yet</h3>
              <p className="text-muted-foreground">
                Create your first outbound campaign to get started
              </p>
              <Link href="/admin/outbound-campaigns/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <Link
                        href={
                          campaign.isWizardComplete
                            ? `/admin/outbound-campaigns/${campaign.id}`
                            : `/admin/outbound-campaigns/new?id=${campaign.id}`
                        }
                        className="font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      {campaign.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {campaign.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{campaign.organizationName || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[campaign.status]}>
                        {campaign.status}
                      </Badge>
                      {!campaign.isWizardComplete && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Step {campaign.currentStep}/7
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{campaign.totalContacts.toLocaleString()}</span>
                        {campaign.contactsCalled > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({campaign.contactsCalled} called)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${getProgressPercent(campaign)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {getProgressPercent(campaign)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
