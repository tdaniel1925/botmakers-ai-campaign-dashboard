"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  MoreVertical,
  Phone,
  Users,
  Clock,
  Play,
  Pause,
  Square,
  Trash2,
  Edit,
  BarChart3,
  Loader2,
  RefreshCw,
  PhoneOutgoing,
  Calendar,
  DollarSign,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface OutboundCampaign {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  status: "draft" | "active" | "paused" | "stopped" | "completed";
  total_contacts: number;
  contacts_completed: number;
  is_test_mode: boolean;
  created_at: string;
  launched_at: string | null;
  clients: {
    id: string;
    name: string;
    company_name: string | null;
  } | null;
  stats?: {
    totalCalls: number;
    positiveCalls: number;
    positiveRate: number;
  };
}

export default function OutboundCampaignsPage() {
  const [campaigns, setCampaigns] = useState<OutboundCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<OutboundCampaign | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/outbound-campaigns");
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
  }, []);

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.clients?.company_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || campaign.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleAction = async (campaign: OutboundCampaign, action: "pause" | "resume" | "stop") => {
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${campaign.id}/${action}`, {
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
    }
  };

  const handleDelete = async () => {
    if (!selectedCampaign) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${selectedCampaign.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete campaign");
      }
      toast({
        title: "Campaign Deleted",
        description: "Campaign has been removed",
      });
      setShowDeleteModal(false);
      setSelectedCampaign(null);
      fetchCampaigns();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete campaign",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outbound Campaigns</h1>
          <p className="text-muted-foreground">
            Manage AI-powered outbound calling campaigns
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/outbound/new">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns or clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchCampaigns} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Campaign Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    <Link href={`/admin/outbound/${campaign.id}`} className="hover:underline">
                      <CardTitle className="text-lg truncate cursor-pointer hover:text-primary">
                        {campaign.name}
                        {campaign.is_test_mode && (
                          <Badge variant="outline" className="ml-2 text-xs">Test</Badge>
                        )}
                      </CardTitle>
                    </Link>
                    <CardDescription className="truncate">
                      {campaign.clients?.name}
                      {campaign.clients?.company_name && ` (${campaign.clients.company_name})`}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/outbound/${campaign.id}`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Campaign
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/outbound/${campaign.id}/analytics`}>
                          <BarChart3 className="mr-2 h-4 w-4" />
                          View Analytics
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {campaign.status === "active" && (
                        <DropdownMenuItem onClick={() => handleAction(campaign, "pause")}>
                          <Pause className="mr-2 h-4 w-4" />
                          Pause Campaign
                        </DropdownMenuItem>
                      )}
                      {campaign.status === "paused" && (
                        <DropdownMenuItem onClick={() => handleAction(campaign, "resume")}>
                          <Play className="mr-2 h-4 w-4" />
                          Resume Campaign
                        </DropdownMenuItem>
                      )}
                      {(campaign.status === "active" || campaign.status === "paused") && (
                        <DropdownMenuItem onClick={() => handleAction(campaign, "stop")}>
                          <Square className="mr-2 h-4 w-4" />
                          Stop Campaign
                        </DropdownMenuItem>
                      )}
                      {campaign.status === "draft" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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

                {/* Status and Launch Info */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
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
                  {getStatusBadge(campaign.status)}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {campaign.status === "draft" ? (
                    <>
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link href={`/admin/outbound/${campaign.id}`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </Button>
                      <Button size="sm" className="w-full" asChild>
                        <Link href={`/admin/outbound/${campaign.id}`}>
                          <Play className="mr-2 h-4 w-4" />
                          Launch
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link href={`/admin/outbound/${campaign.id}/contacts`}>
                          <Users className="mr-2 h-4 w-4" />
                          Contacts
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link href={`/admin/outbound/${campaign.id}/analytics`}>
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Analytics
                        </Link>
                      </Button>
                    </>
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
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Create your first AI-powered outbound calling campaign"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button asChild>
                <Link href="/admin/outbound/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedCampaign?.name}&quot;?
              This action cannot be undone. All contacts and configuration will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
