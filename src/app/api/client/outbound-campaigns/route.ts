import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/client/outbound-campaigns
 * List outbound campaigns for the authenticated client
 */
export async function GET() {
  try {
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

    // Get campaigns for this client
    const { data: campaigns, error } = await supabase
      .from("outbound_campaigns")
      .select(
        `
        id,
        name,
        description,
        status,
        is_test_mode,
        total_contacts,
        contacts_called,
        contacts_completed,
        total_minutes,
        total_cost,
        positive_outcomes,
        negative_outcomes,
        launched_at,
        completed_at,
        created_at,
        updated_at,
        campaign_phone_numbers (
          phone_number,
          friendly_name
        ),
        campaign_schedules (
          days_of_week,
          start_time,
          end_time,
          timezone,
          is_active
        )
      `
      )
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate progress for each campaign
    const campaignsWithProgress = campaigns?.map((campaign) => ({
      ...campaign,
      progress: campaign.total_contacts > 0
        ? Math.round((campaign.contacts_completed / campaign.total_contacts) * 100)
        : 0,
      positive_rate: campaign.contacts_completed > 0
        ? Math.round((campaign.positive_outcomes / campaign.contacts_completed) * 100)
        : 0,
    }));

    return NextResponse.json(campaignsWithProgress || []);
  } catch (error) {
    console.error("Error fetching client campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
