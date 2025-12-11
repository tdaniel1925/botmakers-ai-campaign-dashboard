import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientId } from "@/lib/client-auth";

/**
 * POST /api/client/outbound-campaigns/[id]/stop
 * Client can permanently stop their own campaign
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get client ID (supports impersonation)
    const clientAuth = await getClientId(request);
    if (!clientAuth.authenticated || !clientAuth.clientId) {
      return NextResponse.json(
        { error: clientAuth.error || "Not authenticated" },
        { status: clientAuth.error === "Not authenticated" ? 401 : 403 }
      );
    }

    const clientId = clientAuth.clientId;

    // Get campaign - ensure it belongs to this client
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status, name, total_cost, total_minutes, contacts_completed")
      .eq("id", id)
      .eq("client_id", clientId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Validate status
    if (campaign.status === "stopped" || campaign.status === "completed") {
      return NextResponse.json(
        { error: `Campaign is already ${campaign.status}` },
        { status: 400 }
      );
    }

    if (campaign.status === "draft") {
      return NextResponse.json(
        { error: "Draft campaigns cannot be stopped. Delete them instead." },
        { status: 400 }
      );
    }

    // Update status to stopped
    const { data: updatedCampaign, error: updateError } = await supabase
      .from("outbound_campaigns")
      .update({
        status: "stopped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Mark any in-progress contacts as failed
    await supabase
      .from("campaign_contacts")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("campaign_id", id)
      .eq("status", "in_progress");

    // Get remaining contact count
    const { count: remainingContacts } = await supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "pending");

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: clientId,
      user_type: clientAuth.isImpersonating ? "admin_impersonating" : "client",
      action: "campaign_stopped",
      resource_type: "outbound_campaign",
      resource_id: id,
      details: {
        campaign_name: campaign.name,
        stopped_by: clientAuth.isImpersonating ? "admin" : "client",
        final_stats: {
          total_cost: campaign.total_cost,
          total_minutes: campaign.total_minutes,
          contacts_completed: campaign.contacts_completed,
          contacts_remaining: remainingContacts,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Campaign stopped permanently. Create a new campaign to restart calling.",
      campaign: updatedCampaign,
      final_stats: {
        contacts_completed: campaign.contacts_completed,
        contacts_remaining: remainingContacts,
        total_minutes: campaign.total_minutes,
        total_cost: campaign.total_cost,
      },
    });
  } catch (error) {
    console.error("Error stopping campaign:", error);
    return NextResponse.json(
      { error: "Failed to stop campaign" },
      { status: 500 }
    );
  }
}
