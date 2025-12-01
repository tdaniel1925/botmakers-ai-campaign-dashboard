"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MoreHorizontal,
  Edit,
  Webhook,
  Tags,
  Power,
  Trash2,
  Loader2,
} from "lucide-react";
import type { DbCampaign } from "@/types";

interface CampaignActionsProps {
  campaign: DbCampaign;
}

export function CampaignActions({ campaign }: CampaignActionsProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleToggleActive = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !campaign.is_active }),
      });

      if (!response.ok) {
        throw new Error("Failed to update campaign");
      }

      toast({
        title: campaign.is_active
          ? "Campaign deactivated"
          : "Campaign activated",
        description: `${campaign.name} has been ${campaign.is_active ? "deactivated" : "activated"}`,
      });

      router.refresh();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update campaign status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete campaign");
      }

      toast({
        title: "Campaign deleted",
        description: `${campaign.name} has been deleted`,
      });

      setIsDeleteOpen(false);
      router.refresh();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete campaign",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => router.push(`/admin/campaigns/${campaign.id}`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              router.push(`/admin/campaigns/${campaign.id}/webhook`)
            }
          >
            <Webhook className="mr-2 h-4 w-4" />
            Webhook Config
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              router.push(`/admin/campaigns/${campaign.id}/outcome-tags`)
            }
          >
            <Tags className="mr-2 h-4 w-4" />
            Outcome Tags
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleToggleActive} disabled={isLoading}>
            <Power className="mr-2 h-4 w-4" />
            {campaign.is_active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsDeleteOpen(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {campaign.name}? This action
              cannot be undone and will also delete all associated calls and
              webhook logs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
