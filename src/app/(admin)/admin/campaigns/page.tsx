"use client";

import { useState, useEffect } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import {
  Plus,
  Search,
  Copy,
  Check,
  MoreVertical,
  Phone,
  Activity,
  TrendingUp,
  Clock,
  Webhook,
  Settings,
  BarChart3,
  Play,
  Pause,
  ExternalLink,
  Trash2,
  Edit,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  is_active: boolean;
  webhook_token: string;
  created_at: string;
  updated_at: string;
  clients: {
    id: string;
    name: string;
    company_name: string | null;
  } | null;
  // Computed stats
  _callCount?: number;
  _lastWebhook?: string | null;
  _webhookHealth?: "healthy" | "warning" | "error" | "unknown";
  _positiveRate?: number;
}

interface Client {
  id: string;
  name: string;
  company_name: string | null;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const supabase = createClient();

  // Fetch campaigns with stats
  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("campaigns")
        .select(`
          *,
          clients (
            id,
            name,
            company_name
          )
        `)
        .order("created_at", { ascending: false });

      if (campaignsError) throw campaignsError;

      // Fetch call counts for each campaign
      const campaignIds = campaignsData?.map(c => c.id) || [];

      // Get call counts
      const { data: callCounts } = await supabase
        .from("calls")
        .select("campaign_id, ai_sentiment")
        .in("campaign_id", campaignIds);

      // Get recent webhook logs
      const { data: webhookLogs } = await supabase
        .from("webhook_logs")
        .select("campaign_id, status, created_at")
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false });

      // Compute stats for each campaign
      const enrichedCampaigns = campaignsData?.map(campaign => {
        const campaignCalls = callCounts?.filter(c => c.campaign_id === campaign.id) || [];
        const campaignLogs = webhookLogs?.filter(l => l.campaign_id === campaign.id) || [];
        const positiveCalls = campaignCalls.filter(c => c.ai_sentiment === "positive").length;

        // Determine webhook health
        let webhookHealth: "healthy" | "warning" | "error" | "unknown" = "unknown";
        if (campaignLogs.length > 0) {
          const recentLogs = campaignLogs.slice(0, 5);
          const failedCount = recentLogs.filter(l => l.status === "failed").length;
          if (failedCount === 0) webhookHealth = "healthy";
          else if (failedCount <= 2) webhookHealth = "warning";
          else webhookHealth = "error";
        }

        return {
          ...campaign,
          _callCount: campaignCalls.length,
          _lastWebhook: campaignLogs[0]?.created_at || null,
          _webhookHealth: webhookHealth,
          _positiveRate: campaignCalls.length > 0
            ? Math.round((positiveCalls / campaignCalls.length) * 100)
            : 0,
        };
      }) || [];

      setCampaigns(enrichedCampaigns);

      // Fetch clients for create modal
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, name, company_name")
        .eq("status", "active")
        .order("name");

      setClients(clientsData || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast({
        title: "Error",
        description: "Failed to load campaigns",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch =
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.clients?.company_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && campaign.is_active) ||
      (statusFilter === "inactive" && !campaign.is_active);

    return matchesSearch && matchesStatus;
  });

  // Copy webhook URL
  const copyWebhookUrl = (campaign: Campaign) => {
    const url = `${window.location.origin}/api/webhooks/${campaign.webhook_token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(campaign.id);
    setTimeout(() => setCopiedToken(null), 2000);
    toast({
      title: "Copied!",
      description: "Webhook URL copied to clipboard",
    });
  };

  // Create campaign
  const handleCreate = async () => {
    if (!formName || !formClientId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription || null,
          client_id: formClientId,
          is_active: formIsActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create campaign");
      }

      toast({
        title: "Campaign Created",
        description: "Your new campaign is ready to receive webhooks",
      });

      setShowCreateModal(false);
      resetForm();
      fetchCampaigns();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update campaign
  const handleUpdate = async () => {
    if (!selectedCampaign || !formName) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/campaigns/${selectedCampaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription || null,
          is_active: formIsActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update campaign");
      }

      toast({
        title: "Campaign Updated",
        description: "Changes saved successfully",
      });

      setShowEditModal(false);
      setSelectedCampaign(null);
      resetForm();
      fetchCampaigns();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update campaign",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete campaign
  const handleDelete = async () => {
    if (!selectedCampaign) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/campaigns/${selectedCampaign.id}`, {
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

  // Toggle campaign status
  const toggleStatus = async (campaign: Campaign) => {
    try {
      const response = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaign.name,
          description: campaign.description,
          is_active: !campaign.is_active,
        }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      toast({
        title: campaign.is_active ? "Campaign Paused" : "Campaign Activated",
        description: campaign.is_active
          ? "Webhooks will still be received but not processed"
          : "Campaign is now active and processing webhooks",
      });

      fetchCampaigns();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update campaign status",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormClientId("");
    setFormIsActive(true);
  };

  const openEditModal = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setFormName(campaign.name);
    setFormDescription(campaign.description || "");
    setFormIsActive(campaign.is_active);
    setShowEditModal(true);
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case "healthy":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getHealthLabel = (health: string) => {
    switch (health) {
      case "healthy": return "Healthy";
      case "warning": return "Some Errors";
      case "error": return "Issues";
      default: return "No Data";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your AI calling campaigns and webhook integrations
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
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
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter status" />
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
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                campaign.is_active ? "bg-green-500" : "bg-gray-300"
              }`} />

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{campaign.name}</CardTitle>
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
                      <DropdownMenuItem onClick={() => openEditModal(campaign)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStatus(campaign)}>
                        {campaign.is_active ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause Campaign
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Activate Campaign
                          </>
                        )}
                      </DropdownMenuItem>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">{campaign._callCount || 0}</div>
                    <div className="text-xs text-muted-foreground">Calls</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold text-green-600">
                      {campaign._positiveRate || 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Positive</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center gap-1">
                      {getHealthIcon(campaign._webhookHealth || "unknown")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getHealthLabel(campaign._webhookHealth || "unknown")}
                    </div>
                  </div>
                </div>

                {/* Webhook URL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => copyWebhookUrl(campaign)}
                    >
                      {copiedToken === campaign.id ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3 w-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <code className="block text-xs bg-muted p-2 rounded truncate">
                    /api/webhooks/{campaign.webhook_token.substring(0, 20)}...
                  </code>
                </div>

                {/* Last Activity */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {campaign._lastWebhook
                      ? `Last webhook: ${formatDistanceToNow(new Date(campaign._lastWebhook), { addSuffix: true })}`
                      : "No webhooks received yet"
                    }
                  </span>
                  <Badge variant={campaign.is_active ? "success" : "secondary"} className="text-xs">
                    {campaign.is_active ? "Active" : "Paused"}
                  </Badge>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSelectedCampaign(campaign);
                      setShowWebhookModal(true);
                    }}
                  >
                    <Webhook className="mr-2 h-4 w-4" />
                    Setup
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <a href={`/admin/campaigns/${campaign.id}`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery || statusFilter !== "all"
                ? "No campaigns match your filters"
                : "No campaigns yet"
              }
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Create your first campaign to start receiving AI call data"
              }
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Campaign
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Campaign Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Set up a new campaign to receive AI call data via webhooks
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Select value={formClientId} onValueChange={setFormClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                      {client.company_name && ` (${client.company_name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Q1 Sales Outreach"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this campaign..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-xs text-muted-foreground">
                  Campaign will immediately start processing webhooks
                </p>
              </div>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>
              Update campaign details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Campaign Name *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-xs text-muted-foreground">
                  {formIsActive ? "Campaign is processing webhooks" : "Campaign is paused"}
                </p>
              </div>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedCampaign?.name}&quot;?
              This action cannot be undone. All associated calls, webhook logs,
              and analytics data will be permanently removed.
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

      {/* Webhook Setup Modal */}
      <Dialog open={showWebhookModal} onOpenChange={setShowWebhookModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Webhook Setup</DialogTitle>
            <DialogDescription>
              Configure your AI platform to send call data to this webhook
            </DialogDescription>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4 py-4">
              {/* Webhook URL */}
              <div className="space-y-2">
                <Label>Your Webhook URL</Label>
                <div className="flex gap-2">
                  <code className="flex-1 text-sm bg-muted p-3 rounded-lg break-all">
                    {window.location.origin}/api/webhooks/{selectedCampaign.webhook_token}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyWebhookUrl(selectedCampaign)}
                  >
                    {copiedToken === selectedCampaign.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Quick Setup Steps */}
              <div className="space-y-3">
                <Label>Quick Setup</Label>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Copy the webhook URL above</p>
                      <p className="text-muted-foreground">This is your unique endpoint for this campaign</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Add it to your AI calling platform</p>
                      <p className="text-muted-foreground">Works with Vapi, Bland AI, AutoCalls.ai, and others</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Send a test webhook</p>
                      <p className="text-muted-foreground">Check Webhook Logs to verify it&apos;s working</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto-Detection Info */}
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <CheckCircle2 className="inline h-4 w-4 mr-1" />
                  <strong>Smart Auto-Detection:</strong> Our system automatically extracts
                  transcript, phone number, call duration, and recording URL from any
                  webhook format.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowWebhookModal(false)} className="w-full sm:w-auto">
              Close
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <a href={`/admin/campaigns/${selectedCampaign?.id}/webhook`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Advanced Setup & Testing
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
