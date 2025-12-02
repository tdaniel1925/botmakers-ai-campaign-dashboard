"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Copy, ExternalLink, BarChart3 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { Campaign } from "@/lib/db/schema";

interface CampaignWithClient extends Campaign {
  clients?: { name: string; company_name?: string };
}

export default function EditCampaignPage() {
  const params = useParams();
  const [campaign, setCampaign] = useState<CampaignWithClient | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const webhookUrl = campaign
    ? `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/webhooks/${campaign.webhookToken}`
    : "";

  useEffect(() => {
    async function fetchCampaign() {
      try {
        const response = await fetch(`/api/admin/campaigns/${params.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch campaign");
        }
        const data = await response.json();
        setCampaign(data);
        setName(data.name);
        setDescription(data.description || "");
        setIsActive(data.is_active);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load campaign",
          variant: "destructive",
        });
        router.push("/admin/campaigns");
      } finally {
        setIsLoading(false);
      }
    }

    fetchCampaign();
  }, [params.id, router, toast]);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/campaigns/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          is_active: isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update campaign");
      }

      toast({
        title: "Campaign updated",
        description: "Campaign details have been saved successfully.",
      });

      router.push("/admin/campaigns");
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update campaign",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
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
      <div className="flex items-center space-x-4">
        <Link href="/admin/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Campaign</h1>
          <p className="text-muted-foreground">
            Update campaign information and settings
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>
                Update the campaign information below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Input
                  id="client"
                  value={
                    campaign?.clients
                      ? `${campaign.clients.name}${campaign.clients.company_name ? ` (${campaign.clients.company_name})` : ""}`
                      : ""
                  }
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  placeholder="Q1 Sales Outreach"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this campaign..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Link href="/admin/campaigns">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  {campaign?.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="text-sm">
                  {campaign?.createdAt &&
                    format(
                      new Date(campaign.createdAt),
                      "MMM d, yyyy 'at' h:mm a"
                    )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook URL</CardTitle>
              <CardDescription>
                Use this URL to receive call data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                  {webhookUrl}
                </code>
                <Button variant="ghost" size="icon" onClick={handleCopyWebhook}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex space-x-2">
                <Link href={`/admin/campaigns/${params.id}/webhook`}>
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Configure Webhook
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/admin/campaigns/${params.id}/analytics`}>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Analytics
                </Button>
              </Link>
              <Link href={`/admin/campaigns/${params.id}/outcome-tags`}>
                <Button variant="outline" className="w-full justify-start">
                  Manage Outcome Tags
                </Button>
              </Link>
              <Link href={`/admin/campaigns/${params.id}/webhook`}>
                <Button variant="outline" className="w-full justify-start">
                  Test Webhook
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
