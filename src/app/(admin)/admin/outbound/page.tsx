"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Phone,
  Users,
  Play,
  Pause,
  Square,
  Trash2,
  Edit,
  BarChart3,
  Loader2,
  RefreshCw,
  PhoneOutgoing,
  MoreHorizontal,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  call_provider: string | null;
  vapi_assistant_id: string | null;
  autocalls_assistant_id: number | null;
  synthflow_model_id: string | null;
  campaign_schedules: Array<{ id: string }>;
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

// Check if a campaign setup is complete
function isSetupComplete(campaign: OutboundCampaign): boolean {
  // Must have a call provider configured
  if (!campaign.call_provider) return false;

  // Must have provider-specific assistant ID
  switch (campaign.call_provider) {
    case "vapi":
      return !!campaign.vapi_assistant_id;
    case "autocalls":
      return !!campaign.autocalls_assistant_id;
    case "synthflow":
      return !!campaign.synthflow_model_id;
    default:
      return false;
  }
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  stopped: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function OutboundCampaignsPage() {
  const [campaigns, setCampaigns] = useState<OutboundCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<OutboundCampaign | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
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

  // Bulk selection
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCampaigns.length && filteredCampaigns.length > 0) {
      setSelectedIds(new Set());
      setSelectAllMode(false);
    } else {
      setSelectedIds(new Set(filteredCampaigns.map((c) => c.id)));
      setSelectAllMode(true);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectAllMode(false); // Reset select all mode when manually toggling
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllMode(false);
  };

  // Bulk actions
  const handleBulkPause = async () => {
    setIsSubmitting(true);
    try {
      const activeCampaigns = Array.from(selectedIds).filter((id) => {
        const campaign = campaigns.find((c) => c.id === id);
        return campaign?.status === "active";
      });
      await Promise.all(
        activeCampaigns.map((id) =>
          fetch(`/api/admin/outbound-campaigns/${id}/pause`, { method: "POST" })
        )
      );
      toast({
        title: "Campaigns Paused",
        description: `${activeCampaigns.length} campaign(s) have been paused`,
      });
      setSelectedIds(new Set());
      fetchCampaigns();
    } catch {
      toast({
        title: "Error",
        description: "Failed to pause some campaigns",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkResume = async () => {
    setIsSubmitting(true);
    try {
      const pausedCampaigns = Array.from(selectedIds).filter((id) => {
        const campaign = campaigns.find((c) => c.id === id);
        return campaign?.status === "paused";
      });
      await Promise.all(
        pausedCampaigns.map((id) =>
          fetch(`/api/admin/outbound-campaigns/${id}/resume`, { method: "POST" })
        )
      );
      toast({
        title: "Campaigns Resumed",
        description: `${pausedCampaigns.length} campaign(s) have been resumed`,
      });
      setSelectedIds(new Set());
      fetchCampaigns();
    } catch {
      toast({
        title: "Error",
        description: "Failed to resume some campaigns",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkStop = async () => {
    setIsSubmitting(true);
    try {
      const runningCampaigns = Array.from(selectedIds).filter((id) => {
        const campaign = campaigns.find((c) => c.id === id);
        return campaign?.status === "active" || campaign?.status === "paused";
      });
      await Promise.all(
        runningCampaigns.map((id) =>
          fetch(`/api/admin/outbound-campaigns/${id}/stop`, { method: "POST" })
        )
      );
      toast({
        title: "Campaigns Stopped",
        description: `${runningCampaigns.length} campaign(s) have been stopped`,
      });
      setSelectedIds(new Set());
      fetchCampaigns();
    } catch {
      toast({
        title: "Error",
        description: "Failed to stop some campaigns",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsSubmitting(true);
    try {
      const draftCampaigns = Array.from(selectedIds).filter((id) => {
        const campaign = campaigns.find((c) => c.id === id);
        return campaign?.status === "draft";
      });
      await Promise.all(
        draftCampaigns.map((id) =>
          fetch(`/api/admin/outbound-campaigns/${id}`, { method: "DELETE" })
        )
      );
      toast({
        title: "Campaigns Deleted",
        description: `${draftCampaigns.length} draft campaign(s) have been deleted`,
      });
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      fetchCampaigns();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete some campaigns",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant="secondary" className={statusColors[status] || ""}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getProgress = (campaign: OutboundCampaign) => {
    if (campaign.total_contacts === 0) return 0;
    return Math.round((campaign.contacts_completed / campaign.total_contacts) * 100);
  };

  // Count draft campaigns in selection for delete action
  const draftCountInSelection = Array.from(selectedIds).filter((id) => {
    const campaign = campaigns.find((c) => c.id === id);
    return campaign?.status === "draft";
  }).length;

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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <PhoneOutgoing className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaigns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.filter((c) => c.status === "active").length}
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
              {campaigns.reduce((sum, c) => sum + (c.total_contacts || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.reduce((sum, c) => sum + (c.stats?.totalCalls || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & View Toggle */}
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

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-2 p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {selectAllMode
                  ? `All ${selectedIds.size} campaign${selectedIds.size !== 1 ? "s" : ""} selected`
                  : `${selectedIds.size} selected`}
              </span>
              {!selectAllMode && selectedIds.size < filteredCampaigns.length && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-primary"
                  onClick={toggleSelectAll}
                >
                  Select all {filteredCampaigns.length} campaigns
                </Button>
              )}
              {selectAllMode && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-muted-foreground"
                  onClick={clearSelection}
                >
                  Clear selection
                </Button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkResume}
                disabled={isSubmitting}
              >
                <Play className="mr-2 h-4 w-4" />
                Resume
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkPause}
                disabled={isSubmitting}
              >
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkStop}
                disabled={isSubmitting}
              >
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
              {draftCountInSelection > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={isSubmitting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({draftCountInSelection})
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campaign List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <Card>
            <CardHeader>
              <CardTitle>All Outbound Campaigns</CardTitle>
              <CardDescription>
                Click on a campaign to view details and manage settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === filteredCampaigns.length && filteredCampaigns.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Positive</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(campaign.id)}
                          onCheckedChange={() => toggleSelect(campaign.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={campaign.status === "draft" && !isSetupComplete(campaign)
                            ? `/admin/outbound/new?resume=${campaign.id}`
                            : `/admin/outbound/${campaign.id}`}
                          className="font-medium hover:underline"
                        >
                          {campaign.name}
                        </Link>
                        {campaign.is_test_mode && (
                          <Badge variant="outline" className="ml-2 text-xs">Test</Badge>
                        )}
                        {campaign.status === "draft" && !isSetupComplete(campaign) && (
                          <Badge variant="warning" className="ml-2 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Pending Setup
                          </Badge>
                        )}
                        {campaign.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {campaign.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {campaign.clients?.name || "-"}
                        {campaign.clients?.company_name && (
                          <span className="text-muted-foreground text-sm">
                            {" "}({campaign.clients.company_name})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(campaign.status)}
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <div className="flex justify-between text-xs mb-1">
                            <span>{campaign.contacts_completed}</span>
                            <span className="text-muted-foreground">/ {campaign.total_contacts}</span>
                          </div>
                          <Progress value={getProgress(campaign)} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {campaign.stats?.totalCalls || 0}
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600 font-medium">
                          {campaign.stats?.positiveRate?.toFixed(0) || 0}%
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {campaign.status === "draft" && !isSetupComplete(campaign) ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/outbound/new?resume=${campaign.id}`}>
                                  <Settings className="mr-2 h-4 w-4" />
                                  Continue Setup
                                </Link>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/outbound/${campaign.id}`}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Campaign
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/outbound/${campaign.id}/contacts`}>
                                <Users className="mr-2 h-4 w-4" />
                                Manage Contacts
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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

      {/* Delete Confirmation Modal (single) */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedCampaign?.name}&quot;?
              This action cannot be undone. All contacts and configuration will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteModal(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {draftCountInSelection} Draft Campaign(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {draftCountInSelection} draft campaign(s)?
              This action cannot be undone. Only draft campaigns can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
