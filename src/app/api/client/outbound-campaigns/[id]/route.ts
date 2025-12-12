import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getClientId } from "@/lib/client-auth";

/**
 * GET /api/client/outbound-campaigns/[id]
 * Get a single outbound campaign for the authenticated client
 */
export async function GET(
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

    console.log("[outbound-campaign] Fetching campaign:", {
      campaignId: id,
      clientId,
      isImpersonating: clientAuth.isImpersonating
    });

    // Get campaign - ensure it belongs to this client
    // Note: Using !campaign_phone_numbers_campaign_id_fkey to specify which FK to use
    // because there are multiple relationships between these tables
    const { data: campaign, error } = await supabase
      .from("outbound_campaigns")
      .select(
        `
        *,
        campaign_phone_numbers!campaign_phone_numbers_campaign_id_fkey (
          id,
          phone_number,
          friendly_name,
          provider,
          is_active
        ),
        campaign_schedules (
          id,
          days_of_week,
          start_time,
          end_time,
          timezone,
          is_active
        ),
        campaign_sms_templates (
          id,
          name,
          trigger_type,
          template_body,
          is_active,
          send_count
        )
      `
      )
      .eq("id", id)
      .eq("client_id", clientId)
      .single();

    console.log("[outbound-campaign] Query result:", {
      hasCampaign: !!campaign,
      error: error?.message,
      errorCode: error?.code
    });

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get recent call stats
    const { data: recentCalls } = await supabase
      .from("campaign_calls")
      .select("id, status, outcome, duration_seconds, created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate additional stats
    const progress = campaign.total_contacts > 0
      ? Math.round((campaign.contacts_completed / campaign.total_contacts) * 100)
      : 0;

    // Use stored campaign stats (these are updated by the webhook handler)
    const totalCalls = campaign.contacts_called || 0;
    const positiveCalls = campaign.positive_outcomes || 0;
    const negativeCalls = campaign.negative_outcomes || 0;
    const totalMinutes = parseFloat(campaign.total_minutes || "0");
    const totalCost = parseFloat(campaign.total_cost || "0");

    const positiveRate = totalCalls > 0
      ? Math.round((positiveCalls / totalCalls) * 100)
      : 0;

    const avgCallDuration = recentCalls && recentCalls.length > 0
      ? Math.round(
          recentCalls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) /
            recentCalls.length
        )
      : 0;

    return NextResponse.json({
      ...campaign,
      stats: {
        // Primary stats expected by the frontend detail page
        totalCalls,
        positiveCalls,
        negativeCalls,
        positiveRate,
        totalMinutes,
        totalCost,
        // Additional stats
        progress,
        avgCallDuration,
        contactsRemaining: campaign.total_contacts - campaign.contacts_completed,
      },
      recentCalls: recentCalls || [],
    });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}
