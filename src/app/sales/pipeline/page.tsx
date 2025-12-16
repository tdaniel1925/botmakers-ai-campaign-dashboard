'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Target,
  Loader2,
  DollarSign,
  Users,
  Calendar,
  Phone,
  Mail,
  Building2,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface Stage {
  id: string;
  name: string;
  color: string | null;
  order: number;
}

interface Lead {
  id: string;
  leadNumber: number;
  firstName: string;
  lastName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  stageId: string | null;
  estimatedValue: number | null;
  nextFollowUpAt: string | null;
  createdAt: string;
}

interface StageStats {
  count: number;
  totalValue: number;
}

export default function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [leadsByStage, setLeadsByStage] = useState<Record<string, Lead[]>>({});
  const [stageStats, setStageStats] = useState<Record<string, StageStats>>({});
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPipeline();
  }, []);

  const fetchPipeline = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/sales/pipeline');
      if (!response.ok) throw new Error('Failed to fetch pipeline');
      const data = await response.json();
      setStages(data.stages);
      setLeadsByStage(data.leadsByStage);
      setStageStats(data.stageStats);
      setTotalLeads(data.totalLeads);
      setTotalValue(data.totalValue);
    } catch (error) {
      toast.error('Failed to load pipeline');
    } finally {
      setIsLoading(false);
    }
  };

  const isOverdue = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Pipeline</h1>
          <p className="text-muted-foreground">
            Visual overview of your leads by stage
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">across all stages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalValue / 100)}
            </div>
            <p className="text-xs text-muted-foreground">total estimated value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stages</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stages.length}</div>
            <p className="text-xs text-muted-foreground">active pipeline stages</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-full">
              <Target className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">Stage Management</p>
              <p className="text-sm text-amber-700">
                Leads are moved through stages by administrators. Focus on adding quality leads and keeping notes updated.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Board */}
      {stages.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pipeline stages configured</p>
              <p className="text-sm mt-1">
                Pipeline stages will appear here when set up by administrators
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {/* Unassigned column */}
          {leadsByStage['unassigned']?.length > 0 && (
            <div className="flex-shrink-0 w-80">
              <div className="bg-muted rounded-t-lg p-3 border-b-4 border-gray-400">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Unassigned</h3>
                  <Badge variant="secondary">
                    {leadsByStage['unassigned']?.length || 0}
                  </Badge>
                </div>
              </div>
              <div className="bg-muted/50 rounded-b-lg p-2 min-h-[400px] space-y-2">
                {leadsByStage['unassigned']?.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} isOverdue={isOverdue} />
                ))}
              </div>
            </div>
          )}

          {/* Stage columns */}
          {stages.map((stage) => {
            const stageLeads = leadsByStage[stage.id] || [];
            const stats = stageStats[stage.id] || { count: 0, totalValue: 0 };

            return (
              <div key={stage.id} className="flex-shrink-0 w-80">
                <div
                  className="rounded-t-lg p-3 border-b-4"
                  style={{
                    backgroundColor: `${stage.color}15`,
                    borderColor: stage.color || '#6b7280',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{stage.name}</h3>
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: `${stage.color}30` }}
                    >
                      {stats.count}
                    </Badge>
                  </div>
                  {stats.totalValue > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatCurrency(stats.totalValue / 100)}
                    </p>
                  )}
                </div>
                <div className="bg-muted/50 rounded-b-lg p-2 min-h-[400px] space-y-2">
                  {stageLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} isOverdue={isOverdue} />
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No leads in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeadCard({
  lead,
  isOverdue,
}: {
  lead: Lead;
  isOverdue: (date: string | null) => boolean;
}) {
  return (
    <Link href={`/sales/leads/${lead.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">
                  {lead.firstName} {lead.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  #{lead.leadNumber}
                </p>
              </div>
              {lead.estimatedValue && (
                <Badge variant="outline" className="text-xs">
                  {formatCurrency(lead.estimatedValue / 100)}
                </Badge>
              )}
            </div>

            {lead.company && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{lead.company}</span>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {lead.phone && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                </div>
              )}
              {lead.nextFollowUpAt && (
                <div
                  className={`flex items-center gap-1 text-xs ${
                    isOverdue(lead.nextFollowUpAt)
                      ? 'text-red-600 font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  <span>
                    {isOverdue(lead.nextFollowUpAt) ? 'Overdue' : 'Follow-up'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
