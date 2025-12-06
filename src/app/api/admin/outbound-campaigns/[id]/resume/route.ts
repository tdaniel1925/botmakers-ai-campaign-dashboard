import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * POST /api/admin/outbound-campaigns/[id]/resume
 * Resume a paused campaign
 * - Campaign will start making calls again according to schedule
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
      .select("id, status, name, client_id, is_test_mode")
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Validate status
    if (campaign.status !== "paused") {
      return NextResponse.json(
        { error: `Cannot resume a campaign that is ${campaign.status}. Only paused campaigns can be resumed.` },
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
        .eq("client_id", campaign.client_id)
        .eq("provider", "twilio")
        .eq("is_active", true)
        .single();

      if (!clientApiKey) {
        const { data: paymentMethod } = await supabase
          .from("client_payment_methods")
          .select("id")
          .eq("client_id", campaign.client_id)
          .eq("is_valid", true)
          .single();

        if (!paymentMethod) {
          return NextResponse.json(
            { error: "Client payment method is no longer valid. Please update payment method before resuming." },
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
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "campaign_resumed",
      resource_type: "outbound_campaign",
      resource_id: id,
      details: {
        campaign_name: campaign.name,
        client_id: campaign.client_id,
        pending_contacts: pendingCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Campaign resumed successfully. Calls will resume according to schedule.",
      campaign: updatedCampaign,
      pending_contacts: pendingCount,
    });
  } catch (error) {
    console.error("Error resuming outbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to resume campaign" },
      { status: 500 }
    );
  }
}
