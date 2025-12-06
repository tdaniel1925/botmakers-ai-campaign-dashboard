import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get client by email
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Get campaign - ensure it belongs to this client
    const { data: campaign, error } = await supabase
      .from("outbound_campaigns")
      .select(
        `
        *,
        campaign_phone_numbers (
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
      .eq("client_id", client.id)
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

    const positiveRate = campaign.contacts_completed > 0
      ? Math.round((campaign.positive_outcomes / campaign.contacts_completed) * 100)
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
        progress,
        positiveRate,
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
