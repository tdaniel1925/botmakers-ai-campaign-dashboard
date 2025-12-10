"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { clientFetch } from "@/hooks/use-client-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Phone,
  Clock,
  BarChart3,
  Loader2,
  RefreshCw,
  PhoneIncoming,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface InboundCampaign {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  stats: {
    totalCalls: number;
    completedCalls: number;
    positiveCalls: number;
    positiveRate: number;
  };
  last_call_at: string | null;
}

export default function ClientInboundCampaignsPage() {
  const [campaigns, setCampaigns] = useState<InboundCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { toast } = useToast();

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const response = await clientFetch("/api/client/inbound-campaigns");
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast({
        title: "Error",
        description: "Failed to load inbound campaigns",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();

    // Set up real-time subscriptions for live updates
    const supabase = createClient();

    const channel = supabase
      .channel("client-inbound-campaigns-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbound_campaigns" },
        () => fetchCampaigns()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbound_campaign_calls" },
        () => fetchCampaigns()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && campaign.is_active) ||
      (statusFilter === "inactive" && !campaign.is_active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inbound Campaigns</h1>
        <p className="text-muted-foreground">
          View your AI-powered inbound calling campaigns
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchCampaigns} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Campaigns */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="relative overflow-hidden">
              {/* Status indicator bar */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  campaign.is_active ? "bg-green-500" : "bg-gray-300"
                }`}
              />

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      {campaign.name}
                    </CardTitle>
                    {campaign.description && (
                      <CardDescription className="line-clamp-2">
                        {campaign.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant={campaign.is_active ? "success" : "secondary"}>
                    {campaign.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">{campaign.stats.totalCalls}</div>
                    <div className="text-xs text-muted-foreground">Total Calls</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">{campaign.stats.completedCalls}</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold text-green-600 flex items-center justify-center gap-1">
                      {campaign.stats.positiveRate > 50 && (
                        <TrendingUp className="h-3 w-3" />
                      )}
                      {campaign.stats.positiveRate}%
                    </div>
                    <div className="text-xs text-muted-foreground">Positive</div>
                  </div>
                </div>

                {/* Last Call Info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {campaign.last_call_at ? (
                    <>
                      <Phone className="h-3 w-3" />
                      Last call {formatDistanceToNow(new Date(campaign.last_call_at), { addSuffix: true })}
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/dashboard/inbound/${campaign.id}`}>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      View Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <PhoneIncoming className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery || statusFilter !== "all"
                ? "No campaigns match your filters"
                : "No inbound campaigns yet"}
            </h3>
            <p className="text-muted-foreground text-center">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Contact your administrator to set up an inbound campaign"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
