import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getClientId } from "@/lib/client-auth";

/**
 * GET /api/client/inbound-campaigns/[id]
 * Get a single inbound campaign for the authenticated client
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

    // Get campaign - ensure it belongs to this client
    const { data: campaign, error } = await supabase
      .from("inbound_campaigns")
      .select(`
        id,
        name,
        description,
        is_active,
        webhook_token,
        total_calls,
        calls_completed,
        positive_outcomes,
        negative_outcomes,
        total_minutes,
        created_at,
        updated_at,
        launched_at,
        inbound_campaign_outcome_tags (
          id,
          tag_name,
          tag_color,
          is_positive,
          sort_order
        )
      `)
      .eq("id", id)
      .eq("client_id", clientId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get recent calls
    const { data: recentCalls } = await supabase
      .from("inbound_campaign_calls")
      .select(`
        id,
        caller_phone,
        status,
        sentiment,
        duration_seconds,
        summary,
        created_at,
        inbound_campaign_outcome_tags (
          id,
          tag_name,
          tag_color,
          is_positive
        )
      `)
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate additional stats
    const positiveRate = campaign.calls_completed > 0
      ? Math.round((campaign.positive_outcomes / campaign.calls_completed) * 100)
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
        totalCalls: campaign.total_calls || 0,
        completedCalls: campaign.calls_completed || 0,
        positiveCalls: campaign.positive_outcomes || 0,
        negativeCalls: campaign.negative_outcomes || 0,
        positiveRate,
        totalMinutes: parseFloat(campaign.total_minutes || "0"),
        avgCallDuration,
      },
      recentCalls: recentCalls || [],
    });
  } catch (error) {
    console.error("Error fetching inbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}
