import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { randomBytes } from "crypto";

/**
 * Generate a unique webhook token
 */
function generateWebhookToken(): string {
  return "ib_" + randomBytes(16).toString("hex");
}

/**
 * GET /api/admin/inbound-campaigns
 * List all inbound campaigns with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    const status = searchParams.get("status");

    let query = supabase
      .from("inbound_campaigns")
      .select(`
        *,
        clients (
          id,
          name,
          company_name,
          email
        ),
        campaign_phone_numbers (
          id,
          phone_number,
          friendly_name,
          provider
        )
      `)
      .order("created_at", { ascending: false });

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: campaigns, error } = await query;

    if (error) {
      console.error("Error fetching inbound campaigns:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Remove sensitive data (vapi_api_key) from response
    const safeCampaigns = campaigns?.map((campaign) => {
      const { vapi_api_key, ...rest } = campaign;
      return {
        ...rest,
        has_vapi_key: !!vapi_api_key,
      };
    });

    return NextResponse.json(safeCampaigns);
  } catch (error) {
    console.error("Error in inbound campaigns GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbound campaigns" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/inbound-campaigns
 * Create a new inbound campaign
 *
 * Inbound campaigns are provider-agnostic - they receive call data via webhook
 * from any AI voice provider (Vapi, Bland, Retell, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const {
      client_id,
      name,
      description,
    } = body;

    if (!client_id || !name) {
      return NextResponse.json(
        { error: "Client ID and name are required" },
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
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Generate unique webhook token
    const webhookToken = generateWebhookToken();

    // Create the inbound campaign (no Vapi fields needed - data comes via webhook)
    const { data: campaign, error: createError } = await supabase
      .from("inbound_campaigns")
      .insert({
        client_id,
        name,
        description: description || null,
        webhook_token: webhookToken,
        status: "active", // Inbound campaigns are active immediately
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating inbound campaign:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "created",
      resource_type: "inbound_campaign",
      resource_id: campaign.id,
      details: {
        campaign_name: name,
        client_id,
        webhook_token: webhookToken,
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error("Error creating inbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to create inbound campaign" },
      { status: 500 }
    );
  }
}
