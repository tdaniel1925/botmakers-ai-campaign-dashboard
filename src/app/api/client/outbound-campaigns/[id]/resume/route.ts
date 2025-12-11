import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientId } from "@/lib/client-auth";

/**
 * POST /api/client/outbound-campaigns/[id]/resume
 * Client can resume their own paused campaign
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
      .select("id, status, name, is_test_mode")
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
    if (campaign.status !== "paused") {
      return NextResponse.json(
        { error: `Cannot resume a campaign that is ${campaign.status}` },
        { status: 400 }
      );
    }

    // Check there are still pending contacts
    const { count: pendingCount } = await supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "pending");

    if (!pendingCount || pendingCount === 0) {
      return NextResponse.json(
        { error: "No pending contacts remaining. Campaign cannot be resumed." },
        { status: 400 }
      );
    }

    // Check payment method is still valid (unless test mode or has own keys)
    if (!campaign.is_test_mode) {
      const { data: clientApiKey } = await supabase
        .from("client_api_keys")
        .select("id")
        .eq("client_id", clientId)
        .eq("provider", "twilio")
        .eq("is_active", true)
        .single();

      if (!clientApiKey) {
        const { data: paymentMethod } = await supabase
          .from("client_payment_methods")
          .select("id")
          .eq("client_id", clientId)
          .eq("is_valid", true)
          .single();

        if (!paymentMethod) {
          return NextResponse.json(
            { error: "Please update your payment method before resuming the campaign." },
            { status: 400 }
          );
        }
      }
    }

    // Update status to active
    const { data: updatedCampaign, error: updateError } = await supabase
      .from("outbound_campaigns")
      .update({
        status: "active",
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
      action: "campaign_resumed",
      resource_type: "outbound_campaign",
      resource_id: id,
      details: {
        campaign_name: campaign.name,
        resumed_by: clientAuth.isImpersonating ? "admin" : "client",
        pending_contacts: pendingCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Campaign resumed successfully",
      campaign: updatedCampaign,
      pending_contacts: pendingCount,
    });
  } catch (error) {
    console.error("Error resuming campaign:", error);
    return NextResponse.json(
      { error: "Failed to resume campaign" },
      { status: 500 }
    );
  }
}
