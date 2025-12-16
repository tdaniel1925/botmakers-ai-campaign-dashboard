'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Megaphone,
  Users,
  Calendar,
  Loader2,
  CheckCircle2,
  UserPlus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  myEnrollments: number;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  email: string | null;
  status: string;
  isEnrolled: boolean;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/sales/campaigns');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      setCampaigns(data);
    } catch (error) {
      toast.error('Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  const openEnrollDialog = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setEnrollDialogOpen(true);
    setSelectedLeads(new Set());
    setLeadSearch('');

    try {
      setIsLoadingLeads(true);
      const response = await fetch(`/api/sales/campaigns/${campaign.id}/enroll`);
      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      setLeads(data.leads);
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedCampaign || selectedLeads.size === 0) return;

    try {
      setIsEnrolling(true);
      const response = await fetch(`/api/sales/campaigns/${selectedCampaign.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedLeads) }),
      });

      if (!response.ok) throw new Error('Failed to enroll leads');

      const data = await response.json();
      toast.success(data.message);
      setEnrollDialogOpen(false);
      fetchCampaigns(); // Refresh counts
    } catch (error) {
      toast.error('Failed to enroll leads');
    } finally {
      setIsEnrolling(false);
    }
  };

  const toggleLead = (leadId: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const selectAllUnassigned = () => {
    const unassignedIds = leads.filter((l) => !l.isEnrolled).map((l) => l.id);
    setSelectedLeads(new Set(unassignedIds));
  };

  const filteredLeads = leads.filter((lead) => {
    if (!leadSearch) return true;
    const search = leadSearch.toLowerCase();
    return (
      lead.firstName.toLowerCase().includes(search) ||
      lead.lastName.toLowerCase().includes(search) ||
      (lead.company && lead.company.toLowerCase().includes(search)) ||
      (lead.email && lead.email.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <p className="text-muted-foreground">
          View active campaigns and enroll your leads
        </p>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Megaphone className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-blue-900">Nurture Campaigns</p>
              <p className="text-sm text-blue-700">
                Enroll your leads into active campaigns to automate follow-ups and increase conversions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active campaigns</p>
              <p className="text-sm mt-1">
                Active campaigns will appear here when created by admins
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    {campaign.description && (
                      <CardDescription className="line-clamp-2">
                        {campaign.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {campaign.startDate
                      ? `Started ${formatDateTime(campaign.startDate)}`
                      : 'No start date'}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium">{campaign.myEnrollments} leads enrolled</span>
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={() => openEnrollDialog(campaign)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Enroll Leads
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Enroll Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Enroll Leads in {selectedCampaign?.name}</DialogTitle>
            <DialogDescription>
              Select leads to enroll in this campaign. Already enrolled leads are shown for reference.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm" onClick={selectAllUnassigned}>
                Select All Unenrolled
              </Button>
            </div>

            {isLoadingLeads ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No leads found</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto border rounded-md divide-y">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className={`flex items-center gap-3 p-3 hover:bg-muted/50 ${
                      lead.isEnrolled ? 'bg-green-50' : ''
                    }`}
                  >
                    <Checkbox
                      checked={lead.isEnrolled || selectedLeads.has(lead.id)}
                      disabled={lead.isEnrolled}
                      onCheckedChange={() => !lead.isEnrolled && toggleLead(lead.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {lead.firstName} {lead.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {lead.company || lead.email || 'No company'}
                      </p>
                    </div>
                    {lead.isEnrolled && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Enrolled
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">
                {selectedLeads.size} lead(s) selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleEnroll}
                  disabled={selectedLeads.size === 0 || isEnrolling}
                >
                  {isEnrolling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enrolling...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Enroll {selectedLeads.size} Lead(s)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
