import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { randomUUID } from "crypto";

function generateWebhookToken(): string {
  return "ob_" + randomUUID().replace(/-/g, "");
}


/**
 * GET /api/admin/outbound-campaigns
 * List all outbound campaigns with client info
 */
export async function GET(request: Request) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const clientId = searchParams.get("client_id");

    const supabase = await createClient();

    // Query campaigns with related data - only select needed columns for performance
    let query = supabase
      .from("outbound_campaigns")
      .select(
        `
        id,
        name,
        description,
        client_id,
        status,
        total_contacts,
        contacts_completed,
        is_test_mode,
        created_at,
        launched_at,
        call_provider,
        vapi_assistant_id,
        autocalls_assistant_id,
        synthflow_model_id,
        clients (
          id,
          name,
          company_name
        ),
        campaign_schedules (
          id
        )
      `
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data: campaigns, error } = await query;

    if (error) {
      console.error("Error fetching outbound campaigns:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaigns: campaigns || [] });
  } catch (error) {
    console.error("Error fetching outbound campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch outbound campaigns" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/outbound-campaigns
 * Create a new outbound campaign (initially as draft)
 */
export async function POST(request: Request) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const {
      name,
      description,
      client_id,
      // Billing
      rate_per_minute = 0.05,
      billing_threshold = 50.0,
      // Call limits
      max_concurrent_calls = 50,
      // Retry settings
      retry_enabled = true,
      retry_attempts = 2,
      retry_delay_minutes = 60,
      // Test mode
      is_test_mode = false,
      test_call_limit = 10,
      // Agent config (from wizard)
      agent_config = {},
      // Structured data schema
      structured_data_schema = [],
    } = body;

    if (!name || !client_id) {
      return NextResponse.json(
        { error: "Name and client_id are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Create campaign with webhook token
    const { data: campaign, error } = await supabase
      .from("outbound_campaigns")
      .insert({
        name,
        description,
        client_id,
        status: "draft",
        webhook_token: generateWebhookToken(),
        rate_per_minute,
        billing_threshold,
        max_concurrent_calls,
        retry_enabled,
        retry_attempts,
        retry_delay_minutes,
        is_test_mode,
        test_call_limit,
        agent_config,
        structured_data_schema,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating outbound campaign:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create default schedule (Mon-Fri, 9am-5pm Eastern)
    await supabase.from("campaign_schedules").insert({
      campaign_id: campaign.id,
      days_of_week: [1, 2, 3, 4, 5],
      start_time: "09:00:00",
      end_time: "17:00:00",
      timezone: "America/New_York",
      is_active: true,
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error("Error creating outbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to create outbound campaign" },
      { status: 500 }
    );
  }
}
