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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Megaphone,
  Phone,
  ArrowRight,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";

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
}

export default function PreviewCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = createClient();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      // Get client ID from session storage (preview mode)
      const clientId = sessionStorage.getItem("viewAsClientId");
      if (!clientId) return;

      // Get campaigns with call stats
      const { data: campaignsData } = await supabase
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
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (campaignsData) {
        interface CallRecord {
          id: string;
          status: string;
          created_at: string;
          ai_outcome_tag_id: string | null;
          campaign_outcome_tags: { is_positive: boolean } | null;
        }

        const processedCampaigns = campaignsData.map((campaign) => {
          const calls = (campaign.calls || []) as unknown as CallRecord[];
          const completedCalls = calls.filter((c) => c.status === "completed");
          const positiveOutcomes = calls.filter(
            (c) => c.campaign_outcome_tags?.is_positive === true
          ).length;
          const lastCall = calls.length > 0
            ? calls.reduce((latest, call) =>
                new Date(call.created_at) > new Date(latest.created_at) ? call : latest
              )
            : null;

          return {
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            is_active: campaign.is_active,
            created_at: campaign.created_at,
            call_count: calls.length,
            completed_calls: completedCalls.length,
            last_call_at: lastCall?.created_at || null,
            positive_outcomes: positiveOutcomes,
          };
        });

        setCampaigns(processedCampaigns);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    campaign.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCalls = campaigns.reduce((sum, c) => sum + c.call_count, 0);
  const activeCampaigns = campaigns.filter((c) => c.is_active).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground">
          View campaigns and their call analytics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{campaigns.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCampaigns} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCalls}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Positive Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {campaigns.reduce((sum, c) => sum + c.positive_outcomes, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Successful call outcomes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Campaigns List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campaigns</CardTitle>
              <CardDescription>
                Click on a campaign to view its calls
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 font-semibold">No campaigns found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery
                  ? "Try adjusting your search"
                  : "No campaigns available"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Calls</TableHead>
                  <TableHead className="text-center">Positive</TableHead>
                  <TableHead>Last Call</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => {
                  const successRate = campaign.completed_calls > 0
                    ? Math.round((campaign.positive_outcomes / campaign.completed_calls) * 100)
                    : 0;

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-md">
                            <Megaphone className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            {campaign.description && (
                              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {campaign.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={campaign.is_active ? "success" : "secondary"}>
                          {campaign.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{campaign.call_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {successRate >= 50 ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : successRate > 0 ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : null}
                          <span className={successRate >= 50 ? "text-green-600" : ""}>
                            {campaign.positive_outcomes}
                          </span>
                          {campaign.completed_calls > 0 && (
                            <span className="text-muted-foreground text-xs">
                              ({successRate}%)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {campaign.last_call_at ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(campaign.last_call_at), "MMM d, h:mm a")}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/preview-client/campaigns/${campaign.id}`}>
                            View Calls
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
