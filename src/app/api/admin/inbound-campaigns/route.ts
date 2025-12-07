import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { randomBytes } from "crypto";
import { encrypt } from "@/lib/encryption";

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
      // Vapi credentials
      vapi_api_key,
      vapi_assistant_id,
      vapi_phone_number_id,
      // Legacy fields (kept for compatibility)
      agent_config,
      max_call_duration,
      silence_timeout,
    } = body;

    if (!client_id || !name) {
      return NextResponse.json(
        { error: "Client ID and name are required" },
        { status: 400 }
      );
    }

    // Require Vapi credentials
    if (!vapi_api_key || !vapi_assistant_id) {
      return NextResponse.json(
        { error: "Vapi API Key and Assistant ID are required" },
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

    // Encrypt the Vapi API key before storing
    let encryptedApiKey: string | null = null;
    try {
      encryptedApiKey = encrypt(vapi_api_key);
    } catch (error) {
      console.error("Error encrypting API key:", error);
      return NextResponse.json(
        { error: "Failed to secure API key. Please ensure ENCRYPTION_SECRET is configured." },
        { status: 500 }
      );
    }

    // Create the inbound campaign
    const { data: campaign, error: createError } = await supabase
      .from("inbound_campaigns")
      .insert({
        client_id,
        name,
        description: description || null,
        webhook_token: webhookToken,
        vapi_api_key: encryptedApiKey,
        vapi_assistant_id,
        vapi_phone_number_id: vapi_phone_number_id || null,
        agent_config: agent_config || {},
        max_call_duration: max_call_duration || 300,
        silence_timeout: silence_timeout || 30,
        status: "draft",
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
        has_vapi_credentials: true,
      },
    });

    // Return campaign without sensitive data
    const { vapi_api_key: _, ...safeCampaign } = campaign;
    return NextResponse.json(safeCampaign, { status: 201 });
  } catch (error) {
    console.error("Error creating inbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to create inbound campaign" },
      { status: 500 }
    );
  }
}
