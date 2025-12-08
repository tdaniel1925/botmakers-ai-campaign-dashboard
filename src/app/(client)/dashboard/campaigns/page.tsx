"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Megaphone,
  Phone,
  ArrowRight,
  Search,
  TrendingUp,
  CheckCircle2,
  Clock,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  call_count: number;
  completed_calls: number;
  last_call_at: string | null;
  positive_outcomes: number;
  campaign_type: "legacy" | "inbound" | "outbound";
}

function CampaignsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-10 w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const supabase = createClient();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!client) return;

      const allCampaigns: Campaign[] = [];

      // Fetch legacy campaigns with calls
      const { data: legacyCampaigns } = await supabase
        .from("campaigns")
        .select(`
          id,
          name,
          description,
          is_active,
          created_at,
          calls (
            id,
            status,
            created_at,
            ai_outcome_tag_id,
            campaign_outcome_tags:ai_outcome_tag_id (
              is_positive
            )
          )
        `)
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      if (legacyCampaigns) {
        interface LegacyCallRecord {
          id: string;
          status: string;
          created_at: string;
          ai_outcome_tag_id: string | null;
          campaign_outcome_tags: { is_positive: boolean } | null;
        }

        for (const campaign of legacyCampaigns) {
          const calls = (campaign.calls || []) as unknown as LegacyCallRecord[];
          const completedCalls = calls.filter((c) => c.status === "completed");
          const positiveOutcomes = calls.filter(
            (c) => c.campaign_outcome_tags?.is_positive === true
          ).length;
          const lastCall = calls.length > 0
            ? calls.reduce((latest, call) =>
                new Date(call.created_at) > new Date(latest.created_at) ? call : latest
              )
            : null;

          allCampaigns.push({
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            is_active: campaign.is_active,
            created_at: campaign.created_at,
            call_count: calls.length,
            completed_calls: completedCalls.length,
            last_call_at: lastCall?.created_at || null,
            positive_outcomes: positiveOutcomes,
            campaign_type: "legacy",
          });
        }
      }

      // Fetch inbound campaigns with calls
      const { data: inboundCampaigns } = await supabase
        .from("inbound_campaigns")
        .select(`
          id,
          name,
          description,
          is_active,
          created_at,
          inbound_campaign_calls (
            id,
            status,
            created_at,
            sentiment
          )
        `)
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      if (inboundCampaigns) {
        interface InboundCallRecord {
          id: string;
          status: string;
          created_at: string;
          sentiment: string | null;
        }

        for (const campaign of inboundCampaigns) {
          const calls = (campaign.inbound_campaign_calls || []) as unknown as InboundCallRecord[];
          const completedCalls = calls.filter((c) => c.status === "completed");
          const positiveOutcomes = calls.filter(
            (c) => c.sentiment === "positive"
          ).length;
          const lastCall = calls.length > 0
            ? calls.reduce((latest, call) =>
                new Date(call.created_at) > new Date(latest.created_at) ? call : latest
              )
            : null;

          allCampaigns.push({
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            is_active: campaign.is_active,
            created_at: campaign.created_at,
            call_count: calls.length,
            completed_calls: completedCalls.length,
            last_call_at: lastCall?.created_at || null,
            positive_outcomes: positiveOutcomes,
            campaign_type: "inbound",
          });
        }
      }

      // Fetch outbound campaigns with calls
      const { data: outboundCampaigns } = await supabase
        .from("outbound_campaigns")
        .select(`
          id,
          name,
          description,
          status,
          created_at,
          campaign_calls (
            id,
            status,
            created_at,
            outcome
          )
        `)
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      if (outboundCampaigns) {
        interface OutboundCallRecord {
          id: string;
          status: string;
          created_at: string;
          outcome: string | null;
        }

        for (const campaign of outboundCampaigns) {
          const calls = (campaign.campaign_calls || []) as unknown as OutboundCallRecord[];
          const completedCalls = calls.filter((c) => c.status === "completed");
          const positiveOutcomes = calls.filter(
            (c) => c.outcome === "positive"
          ).length;
          const lastCall = calls.length > 0
            ? calls.reduce((latest, call) =>
                new Date(call.created_at) > new Date(latest.created_at) ? call : latest
              )
            : null;

          allCampaigns.push({
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            is_active: campaign.status === "active",
            created_at: campaign.created_at,
            call_count: calls.length,
            completed_calls: completedCalls.length,
            last_call_at: lastCall?.created_at || null,
            positive_outcomes: positiveOutcomes,
            campaign_type: "outbound",
          });
        }
      }

      // Sort by created_at descending
      allCampaigns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setCampaigns(allCampaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || campaign.campaign_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalCalls = campaigns.reduce((sum, c) => sum + c.call_count, 0);
  const activeCampaigns = campaigns.filter((c) => c.is_active).length;
  const totalPositive = campaigns.reduce((sum, c) => sum + c.positive_outcomes, 0);
  const totalCompleted = campaigns.reduce((sum, c) => sum + c.completed_calls, 0);
  const overallSuccessRate = totalCompleted > 0 ? Math.round((totalPositive / totalCompleted) * 100) : 0;

  const getCampaignLink = (campaign: Campaign) => {
    switch (campaign.campaign_type) {
      case "inbound":
        return `/dashboard/inbound/${campaign.id}`;
      case "outbound":
        return `/dashboard/outbound/${campaign.id}`;
      case "legacy":
      default:
        return `/dashboard/campaigns/${campaign.id}`;
    }
  };

  const getCampaignIcon = (type: string) => {
    switch (type) {
      case "inbound":
        return PhoneIncoming;
      case "outbound":
        return PhoneOutgoing;
      default:
        return Megaphone;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "inbound":
        return "Inbound";
      case "outbound":
        return "Outbound";
      case "legacy":
        return "Legacy";
      default:
        return type;
    }
  };

  if (isLoading) {
    return <CampaignsSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground">
          View your campaigns and their call analytics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Campaigns
            </CardTitle>
            <div className="rounded-full bg-violet-100 dark:bg-violet-900/20 p-2">
              <Megaphone className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{campaigns.length}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {activeCampaigns} active
              </Badge>
              <span className="text-xs text-muted-foreground">
                {campaigns.length - activeCampaigns} inactive
              </span>
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-violet-600" />
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Calls
            </CardTitle>
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/20 p-2">
              <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all campaigns
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/20 p-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overallSuccessRate}%</div>
            <div className="mt-2">
              <Progress value={overallSuccessRate} className="h-2" />
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600" />
        </Card>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Your Campaigns</CardTitle>
              <CardDescription>
                Click on a campaign to view its calls and analytics
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="legacy">Legacy</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Megaphone className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No campaigns found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {searchQuery || typeFilter !== "all"
                  ? "Try adjusting your search or filter"
                  : "You don't have any campaigns yet. Contact your administrator to set up campaigns."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCampaigns.map((campaign) => {
                const successRate = campaign.completed_calls > 0
                  ? Math.round((campaign.positive_outcomes / campaign.completed_calls) * 100)
                  : 0;
                const CampaignIcon = getCampaignIcon(campaign.campaign_type);

                return (
                  <Link
                    key={`${campaign.campaign_type}-${campaign.id}`}
                    href={getCampaignLink(campaign)}
                    className="block"
                  >
                    <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/20 transition-all duration-200">
                      <div className="flex items-start sm:items-center gap-4 mb-4 sm:mb-0">
                        <div className="rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                          <CampaignIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                              {campaign.name}
                            </h3>
                            <Badge
                              variant={campaign.is_active ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {campaign.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(campaign.campaign_type)}
                            </Badge>
                          </div>
                          {campaign.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 max-w-md">
                              {campaign.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Created {format(new Date(campaign.created_at), "MMM d, yyyy")}
                            </span>
                            {campaign.last_call_at && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                Last call {formatDistanceToNow(new Date(campaign.last_call_at), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6">
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-2xl font-bold">{campaign.call_count}</p>
                            <p className="text-xs text-muted-foreground">Calls</p>
                          </div>
                          <div className="text-center min-w-[80px]">
                            <div className="flex items-center justify-center gap-1">
                              {successRate >= 50 && (
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                              )}
                              <p className={`text-2xl font-bold ${successRate >= 50 ? "text-emerald-600" : ""}`}>
                                {successRate}%
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">Success</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        >
                          View
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
