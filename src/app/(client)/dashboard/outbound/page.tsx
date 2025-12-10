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
  Users,
  Clock,
  Play,
  Pause,
  Square,
  BarChart3,
  Loader2,
  RefreshCw,
  PhoneOutgoing,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface OutboundCampaign {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "stopped" | "completed";
  total_contacts: number;
  contacts_completed: number;
  is_test_mode: boolean;
  created_at: string;
  launched_at: string | null;
  stats?: {
    totalCalls: number;
    positiveCalls: number;
    positiveRate: number;
  };
}

export default function ClientOutboundCampaignsPage() {
  const [campaigns, setCampaigns] = useState<OutboundCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const response = await clientFetch("/api/client/outbound-campaigns");
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast({
        title: "Error",
        description: "Failed to load outbound campaigns",
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
      .channel("client-outbound-campaigns-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outbound_campaigns" },
        () => fetchCampaigns()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_calls" },
        () => fetchCampaigns()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAction = async (campaignId: string, action: "pause" | "resume" | "stop") => {
    setActionLoading(campaignId);
    try {
      const response = await clientFetch(`/api/client/outbound-campaigns/${campaignId}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} campaign`);
      }
      toast({
        title: "Success",
        description: `Campaign ${action === "pause" ? "paused" : action === "resume" ? "resumed" : "stopped"} successfully`,
      });
      fetchCampaigns();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} campaign`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "paused":
        return <Badge variant="warning">Paused</Badge>;
      case "stopped":
        return <Badge variant="destructive">Stopped</Badge>;
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getProgress = (campaign: OutboundCampaign) => {
    if (campaign.total_contacts === 0) return 0;
    return Math.round((campaign.contacts_completed / campaign.total_contacts) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Outbound Campaigns</h1>
        <p className="text-muted-foreground">
          View and manage your AI-powered outbound calling campaigns
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
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
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
                  campaign.status === "active"
                    ? "bg-green-500"
                    : campaign.status === "paused"
                    ? "bg-yellow-500"
                    : campaign.status === "stopped"
                    ? "bg-red-500"
                    : campaign.status === "completed"
                    ? "bg-blue-500"
                    : "bg-gray-300"
                }`}
              />

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      {campaign.name}
                      {campaign.is_test_mode && (
                        <Badge variant="outline" className="ml-2 text-xs">Test</Badge>
                      )}
                    </CardTitle>
                    {campaign.description && (
                      <CardDescription className="line-clamp-2">
                        {campaign.description}
                      </CardDescription>
                    )}
                  </div>
                  {getStatusBadge(campaign.status)}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">{campaign.total_contacts}</div>
                    <div className="text-xs text-muted-foreground">Contacts</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">{campaign.stats?.totalCalls || 0}</div>
                    <div className="text-xs text-muted-foreground">Calls</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold text-green-600">
                      {campaign.stats?.positiveRate?.toFixed(0) || 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Positive</div>
                  </div>
                </div>

                {/* Progress bar */}
                {campaign.status !== "draft" && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{getProgress(campaign)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${getProgress(campaign)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Launch Info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {campaign.launched_at ? (
                    <>
                      <Calendar className="h-3 w-3" />
                      Launched {formatDistanceToNow(new Date(campaign.launched_at), { addSuffix: true })}
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/dashboard/outbound/${campaign.id}`}>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      View Details
                    </Link>
                  </Button>
                  {campaign.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleAction(campaign.id, "pause")}
                      disabled={actionLoading === campaign.id}
                    >
                      {actionLoading === campaign.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Pause className="mr-2 h-4 w-4" />
                      )}
                      Pause
                    </Button>
                  )}
                  {campaign.status === "paused" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleAction(campaign.id, "resume")}
                      disabled={actionLoading === campaign.id}
                    >
                      {actionLoading === campaign.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      Resume
                    </Button>
                  )}
                  {(campaign.status === "completed" || campaign.status === "stopped") && (
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href={`/dashboard/outbound/${campaign.id}/calls`}>
                        <Phone className="mr-2 h-4 w-4" />
                        Call Logs
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <PhoneOutgoing className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery || statusFilter !== "all"
                ? "No campaigns match your filters"
                : "No outbound campaigns yet"}
            </h3>
            <p className="text-muted-foreground text-center">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Contact your administrator to set up an outbound campaign"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
