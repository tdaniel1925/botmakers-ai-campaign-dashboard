import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getClientId } from "@/lib/client-auth";

/**
 * POST /api/client/outbound-campaigns/[id]/pause
 * Client can pause their own active campaign
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get client ID (supports impersonation)
    const clientAuth = await getClientId(request);
    if (!clientAuth.authenticated || !clientAuth.clientId) {
      return NextResponse.json(
        { error: clientAuth.error || "Not authenticated" },
        { status: clientAuth.error === "Not authenticated" ? 401 : 403 }
      );
    }

    const clientId = clientAuth.clientId;

    // Use service client when impersonating to bypass RLS
    const supabase = clientAuth.isImpersonating
      ? await createServiceClient()
      : await createClient();

    // Get campaign - ensure it belongs to this client
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status, name")
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
    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: `Cannot pause a campaign that is ${campaign.status}` },
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
      user_id: clientId,
      user_type: clientAuth.isImpersonating ? "admin_impersonating" : "client",
      action: "campaign_paused",
      resource_type: "outbound_campaign",
      resource_id: id,
      details: {
        campaign_name: campaign.name,
        paused_by: clientAuth.isImpersonating ? "admin" : "client",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Campaign paused successfully",
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error("Error pausing campaign:", error);
    return NextResponse.json(
      { error: "Failed to pause campaign" },
      { status: 500 }
    );
  }
}
