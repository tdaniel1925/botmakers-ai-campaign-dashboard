import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { deleteVapiAssistant } from "@/lib/vapi/assistant";

/**
 * POST /api/admin/outbound-campaigns/[id]/stop
 * Permanently stop a campaign
 * - Cannot be restarted (create a new campaign instead)
 * - Active calls will complete but no new calls initiated
 * - Vapi assistant is deleted
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createClient();

    // Get campaign
    const { data: campaign, error: fetchError } = await supabase
      .from("outbound_campaigns")
      .select("id, status, name, client_id, vapi_assistant_id, total_cost, total_minutes, contacts_completed, total_contacts")
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
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
        { error: "Draft campaigns should be deleted, not stopped" },
        { status: 400 }
      );
    }

    // Delete Vapi assistant if exists
    if (campaign.vapi_assistant_id) {
      try {
        await deleteVapiAssistant(campaign.vapi_assistant_id);
      } catch (vapiError) {
        console.error("Error deleting Vapi assistant:", vapiError);
        // Continue anyway - don't block stopping the campaign
      }
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

    // Get final stats
    const { count: pendingContacts } = await supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "pending");

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "campaign_stopped",
      resource_type: "outbound_campaign",
      resource_id: id,
      details: {
        campaign_name: campaign.name,
        client_id: campaign.client_id,
        final_stats: {
          total_cost: campaign.total_cost,
          total_minutes: campaign.total_minutes,
          contacts_completed: campaign.contacts_completed,
          contacts_remaining: pendingContacts,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Campaign stopped permanently. Create a new campaign to restart calling.",
      campaign: updatedCampaign,
      final_stats: {
        contacts_completed: campaign.contacts_completed,
        contacts_remaining: pendingContacts,
        total_minutes: campaign.total_minutes,
        total_cost: campaign.total_cost,
      },
    });
  } catch (error) {
    console.error("Error stopping outbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to stop campaign" },
      { status: 500 }
    );
  }
}
