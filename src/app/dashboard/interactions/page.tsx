'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  PhoneIncoming,
  Search,
  Flag,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Globe,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Interaction, Campaign, Organization } from '@/db/schema';
import Link from 'next/link';
import { formatDateTime, formatDuration, formatPhoneNumber } from '@/lib/utils';

type InteractionWithRelations = Interaction & {
  campaign: Campaign & {
    organization: Organization;
  };
};

export default function ClientInteractionsPage() {
  const [interactions, setInteractions] = useState<InteractionWithRelations[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchInteractions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      if (search) params.set('search', search);
      if (campaignFilter !== 'all') params.set('campaignId', campaignFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/interactions?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch interactions');
      }

      setInteractions(result.data);
      setTotal(result.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch interactions');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, campaignFilter, statusFilter]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch('/api/campaigns');
      const result = await response.json();
      if (response.ok) {
        setCampaigns(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    }
  }, []);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const totalPages = Math.ceil(total / limit);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Interactions</h1>
          <p className="text-muted-foreground">
            View all interactions from your campaigns
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>All Interactions</CardTitle>
              <span className="text-sm text-muted-foreground">
                {total} total interactions
              </span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search phone, summary..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <Select
                value={campaignFilter}
                onValueChange={(value) => {
                  setCampaignFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Campaign" />
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

              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : interactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PhoneIncoming className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No interactions found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter !== 'all' || campaignFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Interactions will appear here as calls are received'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone / Source</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interactions.map((interaction) => (
                    <TableRow key={interaction.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSourceIcon(interaction.sourceType)}
                          <div>
                            <p className="font-medium">
                              {interaction.phoneNumber
                                ? formatPhoneNumber(interaction.phoneNumber)
                                : 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {interaction.sourcePlatform || interaction.sourceType}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{interaction.campaign.name}</p>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate" title={interaction.aiSummary || ''}>
                          {interaction.aiSummary || 'No summary available'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(interaction.callStatus)}>
                          {interaction.callStatus || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {interaction.durationSeconds
                          ? formatDuration(interaction.durationSeconds)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(interaction.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/interactions/${interaction.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
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
    </div>
  );
}
