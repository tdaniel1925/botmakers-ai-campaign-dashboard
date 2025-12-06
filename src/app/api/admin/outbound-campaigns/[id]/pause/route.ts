import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * POST /api/admin/outbound-campaigns/[id]/pause
 * Pause an active campaign
 * - No new calls will be initiated
 * - Active calls will continue until completion
 * - Can be resumed later
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
      .select("id, status, name, client_id")
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Validate status
    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: `Cannot pause a campaign that is ${campaign.status}. Only active campaigns can be paused.` },
        { status: 400 }
      );
    }

    // Update status to paused
    const { data: updatedCampaign, error: updateError } = await supabase
      .from("outbound_campaigns")
      .update({
        status: "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "campaign_paused",
      resource_type: "outbound_campaign",
      resource_id: id,
      details: {
        campaign_name: campaign.name,
        client_id: campaign.client_id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Campaign paused successfully. No new calls will be initiated.",
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error("Error pausing outbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to pause campaign" },
      { status: 500 }
    );
  }
}
