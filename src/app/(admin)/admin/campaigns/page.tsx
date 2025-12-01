import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { CampaignActions } from "./campaign-actions";

export default async function CampaignsPage() {
  const supabase = await createClient();

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select(
      `
      *,
      clients (
        name,
        company_name
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching campaigns:", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage campaigns and webhook configurations
          </p>
        </div>
        <Link href="/admin/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Campaign
          </Button>
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Webhook Token</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns && campaigns.length > 0 ? (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    {campaign.clients?.name || "Unknown"}
                    {campaign.clients?.company_name && (
                      <span className="text-muted-foreground ml-1">
                        ({campaign.clients.company_name})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {campaign.webhook_token.substring(0, 12)}...
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-1"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/${campaign.webhook_token}`
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    {campaign.is_active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(campaign.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <CampaignActions campaign={campaign} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No campaigns found. Create your first campaign to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
