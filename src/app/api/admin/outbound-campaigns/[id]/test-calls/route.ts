import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { decrypt } from "@/lib/encryption";

/**
 * GET /api/admin/outbound-campaigns/[id]/test-calls
 * Get test calls for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createServiceClient();

    // Get test calls for this campaign (marked with is_test = true)
    const { data: calls, error } = await supabase
      .from("campaign_calls")
      .select("*")
      .eq("campaign_id", id)
      .eq("is_test", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching test calls:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ calls: calls || [] });
  } catch (error) {
    console.error("Error fetching test calls:", error);
    return NextResponse.json(
      { error: "Failed to fetch test calls" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/outbound-campaigns/[id]/test-calls
 * Initiate a test call
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

    const body = await request.json();
    const { phone_number, first_name } = body;

    if (!phone_number) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phone_number);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Get campaign with provider details
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Validate provider is configured
    if (!campaign.call_provider) {
      return NextResponse.json(
        { error: "No call provider configured for this campaign" },
        { status: 400 }
      );
    }

    // Get webhook URL for callbacks
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (() => {
      const host = request.headers.get("host") || "localhost:3000";
      const protocol = host.includes("localhost") ? "http" : "https";
      return `${protocol}://${host}`;
    })();

    // Create call record first
    const { data: callRecord, error: callRecordError } = await supabase
      .from("campaign_calls")
      .insert({
        campaign_id: id,
        contact_id: null, // Test calls don't have a contact
        phone_number: normalizedPhone,
        first_name: first_name || null,
        status: "initiated",
        is_test: true,
        attempt_number: 1,
      })
      .select()
      .single();

    if (callRecordError) {
      console.error("Error creating call record:", callRecordError);
      return NextResponse.json(
        { error: "Failed to create call record" },
        { status: 500 }
      );
    }

    // Initiate call based on provider
    let result;
    try {
      switch (campaign.call_provider) {
        case "vapi":
          result = await initiateVapiCall(
            campaign,
            normalizedPhone,
            first_name,
            callRecord.id,
            baseUrl
          );
          break;
        case "autocalls":
          result = await initiateAutoCallsCall(
            campaign,
            normalizedPhone,
            first_name,
            callRecord.id,
            baseUrl
          );
          break;
        case "synthflow":
          result = await initiateSynthflowCall(
            campaign,
            normalizedPhone,
            first_name,
            callRecord.id,
            baseUrl
          );
          break;
        default:
          throw new Error(`Unknown provider: ${campaign.call_provider}`);
      }

      // Update call record with provider call ID
      await supabase
        .from("campaign_calls")
        .update({
          vapi_call_id: result.callId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", callRecord.id);

      // Log the action
      await supabase.from("audit_logs").insert({
        user_id: authResult.admin!.id,
        user_type: "admin",
        user_email: authResult.admin!.email,
        action: "test_call_initiated",
        resource_type: "outbound_campaign",
        resource_id: id,
        details: {
          call_record_id: callRecord.id,
          phone_number: normalizedPhone,
          first_name: first_name || null,
          provider: campaign.call_provider,
          provider_call_id: result.callId,
        },
      });

      return NextResponse.json({
        success: true,
        call_id: callRecord.id,
        provider_call_id: result.callId,
      });
    } catch (providerError) {
      console.error("Provider call error:", providerError);

      // Update call record with error
      await supabase
        .from("campaign_calls")
        .update({
          status: "failed",
          vapi_ended_reason: providerError instanceof Error ? providerError.message : "Unknown error",
          ended_at: new Date().toISOString(),
        })
        .eq("id", callRecord.id);

      return NextResponse.json(
        {
          error: providerError instanceof Error ? providerError.message : "Failed to initiate call",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error initiating test call:", error);
    return NextResponse.json(
      { error: "Failed to initiate test call" },
      { status: 500 }
    );
  }
}

/**
 * Initiate a Vapi call
 */
async function initiateVapiCall(
  campaign: Record<string, unknown>,
  phoneNumber: string,
  firstName: string | undefined,
  callRecordId: string,
  baseUrl: string
): Promise<{ callId: string }> {
  // Get API key
  let apiKey: string;
  if (campaign.vapi_key_source === "system") {
    apiKey = process.env.VAPI_API_KEY || "";
    if (!apiKey) {
      throw new Error("System Vapi API key is not configured");
    }
  } else {
    if (!campaign.vapi_api_key) {
      throw new Error("Vapi API key not configured for this campaign");
    }
    apiKey = decrypt(campaign.vapi_api_key as string);
  }

  if (!campaign.vapi_assistant_id) {
    throw new Error("Vapi assistant ID not configured");
  }

  // Build webhook URL with campaign token
  const webhookUrl = `${baseUrl}/api/webhooks/outbound/${campaign.webhook_token}`;

  // Build call payload
  const payload: Record<string, unknown> = {
    assistantId: campaign.vapi_assistant_id,
    customer: {
      number: phoneNumber,
    },
    metadata: {
      campaignId: campaign.id,
      callRecordId: callRecordId,
      isTest: true,
      firstName: firstName || undefined,
    },
  };

  // Add phone number ID if configured
  if (campaign.vapi_phone_number_id) {
    payload.phoneNumberId = campaign.vapi_phone_number_id;
  }

  // Add variable values for first name if provided
  if (firstName) {
    payload.assistantOverrides = {
      variableValues: {
        firstName: firstName,
        first_name: firstName,
        name: firstName,
        customerName: firstName,
      },
    };
  }

  // Add webhook URL
  payload.serverUrl = webhookUrl;

  const response = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi call error:", errorData);
    throw new Error(errorData.message || `Vapi API error: ${response.status}`);
  }

  const data = await response.json();
  return { callId: data.id };
}

/**
 * Initiate an AutoCalls.ai call
 */
async function initiateAutoCallsCall(
  campaign: Record<string, unknown>,
  phoneNumber: string,
  firstName: string | undefined,
  callRecordId: string,
  baseUrl: string
): Promise<{ callId: string }> {
  // Get API key
  if (!campaign.provider_api_key) {
    throw new Error("AutoCalls.ai API key not configured");
  }
  const apiKey = decrypt(campaign.provider_api_key as string);

  if (!campaign.autocalls_assistant_id) {
    throw new Error("AutoCalls.ai assistant ID not configured");
  }

  // Build webhook URL
  const webhookUrl = `${baseUrl}/api/webhooks/outbound/${campaign.webhook_token}`;

  // Build call payload based on AutoCalls.ai API
  const payload: Record<string, unknown> = {
    assistant_id: campaign.autocalls_assistant_id,
    phone_number: phoneNumber,
    webhook_url: webhookUrl,
    metadata: {
      campaignId: campaign.id,
      callRecordId: callRecordId,
      isTest: true,
    },
  };

  // Add variables if first name provided
  if (firstName) {
    payload.variables = {
      firstName: firstName,
      first_name: firstName,
      name: firstName,
    };
  }

  const response = await fetch("https://app.autocalls.ai/api/user/calls/create", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("AutoCalls call error:", errorData);
    throw new Error(errorData.message || `AutoCalls.ai API error: ${response.status}`);
  }

  const data = await response.json();
  return { callId: data.call_id || data.id || String(Date.now()) };
}

/**
 * Initiate a Synthflow call
 */
async function initiateSynthflowCall(
  campaign: Record<string, unknown>,
  phoneNumber: string,
  firstName: string | undefined,
  callRecordId: string,
  baseUrl: string
): Promise<{ callId: string }> {
  // Get API key
  if (!campaign.provider_api_key) {
    throw new Error("Synthflow API key not configured");
  }
  const apiKey = decrypt(campaign.provider_api_key as string);

  if (!campaign.synthflow_model_id) {
    throw new Error("Synthflow model ID not configured");
  }

  // Build webhook URL
  const webhookUrl = `${baseUrl}/api/webhooks/outbound/${campaign.webhook_token}`;

  // Build call payload based on Synthflow API
  const payload: Record<string, unknown> = {
    model_id: campaign.synthflow_model_id,
    phone_number: phoneNumber,
    webhook_url: webhookUrl,
    metadata: {
      campaignId: campaign.id as string,
      callRecordId: callRecordId,
      isTest: true,
    },
  };

  // Add variables if first name provided
  if (firstName) {
    payload.variables = {
      firstName: firstName,
      first_name: firstName,
      name: firstName,
    };
  }

  const response = await fetch("https://api.synthflow.ai/v2/calls", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Synthflow call error:", errorData);
    throw new Error(errorData.message || `Synthflow API error: ${response.status}`);
  }

  const data = await response.json();
  return { callId: data.call_id || data.id || String(Date.now()) };
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  const phoneStr = phone.toString().trim();
  if (!phoneStr) return null;

  const hasPlus = phoneStr.startsWith("+");
  const digits = phoneStr.replace(/\D/g, "");

  if (digits.length < 7) return null;

  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  } else if (digits.length >= 7 && digits.length <= 15) {
    if (hasPlus || digits.length >= 10) {
      return `+${digits}`;
    }
    return `+1${digits}`;
  }

  return null;
}
