import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import {
  provisionVapiPhoneNumber,
  importTwilioPhoneNumber,
  assignAssistantToPhoneNumber,
  searchAvailablePhoneNumbers,
  purchaseTwilioPhoneNumber,
} from "@/lib/vapi/phone-numbers";
import { decrypt } from "@/lib/encryption";

interface ClientTwilioKeys {
  accountSid: string;
  authToken: string;
}

/**
 * Get client's Twilio API keys from client_api_keys table
 */
async function getClientTwilioKeys(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string
): Promise<ClientTwilioKeys | null> {
  const { data } = await supabase
    .from("client_api_keys")
    .select("account_sid, api_secret, is_active")
    .eq("client_id", clientId)
    .eq("provider", "twilio")
    .eq("is_active", true)
    .single();

  if (!data?.account_sid || !data?.api_secret) {
    return null;
  }

  // Decrypt the auth token if encrypted
  let authToken = data.api_secret;
  try {
    if (authToken.includes(":")) {
      authToken = decrypt(authToken);
    }
  } catch {
    // Use as-is if decryption fails
  }

  return {
    accountSid: data.account_sid,
    authToken,
  };
}

/**
 * POST /api/admin/outbound-campaigns/[id]/phone-numbers/provision
 * Provision a new phone number for the campaign
 *
 * Three modes:
 * 1. mode: "vapi" - Provision through Vapi (uses their Twilio sub-account)
 * 2. mode: "twilio-import" - Import existing Twilio number to Vapi
 * 3. mode: "twilio-purchase" - Purchase new Twilio number and import to Vapi
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
    const { mode, areaCode, twilioPhoneSid, phoneNumber, friendlyName } = body;

    if (!mode) {
      return NextResponse.json(
        { error: "Provisioning mode is required (vapi, twilio-import, or twilio-purchase)" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get campaign with client info
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select(`
        id,
        name,
        status,
        client_id,
        vapi_assistant_id,
        clients (
          id,
          name
        )
      `)
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Phone numbers can only be provisioned for draft campaigns" },
        { status: 400 }
      );
    }

    // Get the webhook URL for this environment
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/webhooks/vapi-outbound`;

    let vapiPhoneNumber;
    let provisionedPhoneNumber: string;
    let twilioSid: string | null = null;

    switch (mode) {
      case "vapi": {
        // Provision through Vapi's Twilio sub-account
        if (!areaCode) {
          return NextResponse.json(
            { error: "Area code is required for Vapi provisioning" },
            { status: 400 }
          );
        }

        const clientData = campaign.clients as unknown as { id: string; name: string } | null;
        const phoneName = `${campaign.name} - ${clientData?.name || "Campaign"}`;

        vapiPhoneNumber = await provisionVapiPhoneNumber({
          areaCode,
          name: phoneName,
          assistantId: campaign.vapi_assistant_id || undefined,
          serverUrl: webhookUrl,
        });

        provisionedPhoneNumber = vapiPhoneNumber.number;
        break;
      }

      case "twilio-import": {
        // Import existing Twilio number
        // phoneNumber should be in E.164 format (e.g., +15551234567)
        if (!phoneNumber) {
          return NextResponse.json(
            { error: "Phone number is required for import (E.164 format, e.g., +15551234567)" },
            { status: 400 }
          );
        }

        // Get client's Twilio credentials
        const twilioKeys = await getClientTwilioKeys(supabase, campaign.client_id);
        if (!twilioKeys) {
          return NextResponse.json(
            { error: "Client Twilio credentials not configured. Please add Twilio API keys in settings." },
            { status: 400 }
          );
        }

        const clientData2 = campaign.clients as unknown as { id: string; name: string } | null;
        const phoneName2 = `${campaign.name} - ${clientData2?.name || "Campaign"}`;

        vapiPhoneNumber = await importTwilioPhoneNumber({
          twilioAccountSid: twilioKeys.accountSid,
          twilioAuthToken: twilioKeys.authToken,
          twilioPhoneNumber: phoneNumber, // E.164 format
          name: phoneName2,
          assistantId: campaign.vapi_assistant_id || undefined,
          serverUrl: webhookUrl,
        });

        provisionedPhoneNumber = vapiPhoneNumber.number;
        twilioSid = twilioPhoneSid || null; // Optional Twilio SID for reference
        break;
      }

      case "twilio-purchase": {
        // Purchase new Twilio number and import to Vapi
        if (!phoneNumber) {
          return NextResponse.json(
            { error: "Phone number to purchase is required" },
            { status: 400 }
          );
        }

        // Get client's Twilio credentials
        const twilioKeys2 = await getClientTwilioKeys(supabase, campaign.client_id);
        if (!twilioKeys2) {
          return NextResponse.json(
            { error: "Client Twilio credentials not configured. Please add Twilio API keys in settings." },
            { status: 400 }
          );
        }

        // First, purchase the number from Twilio
        const purchasedNumber = await purchaseTwilioPhoneNumber(
          twilioKeys2.accountSid,
          twilioKeys2.authToken,
          phoneNumber,
          friendlyName || `${campaign.name}`
        );

        // Then import it to Vapi using the purchased phone number (E.164 format)
        const clientData3 = campaign.clients as unknown as { id: string; name: string } | null;
        const phoneName3 = `${campaign.name} - ${clientData3?.name || "Campaign"}`;

        vapiPhoneNumber = await importTwilioPhoneNumber({
          twilioAccountSid: twilioKeys2.accountSid,
          twilioAuthToken: twilioKeys2.authToken,
          twilioPhoneNumber: purchasedNumber.phoneNumber, // E.164 format from Twilio
          name: phoneName3,
          assistantId: campaign.vapi_assistant_id || undefined,
          serverUrl: webhookUrl,
        });

        provisionedPhoneNumber = vapiPhoneNumber.number;
        twilioSid = purchasedNumber.sid;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Invalid provisioning mode" },
          { status: 400 }
        );
    }

    // If campaign already has an assistant, make sure the phone is linked
    if (campaign.vapi_assistant_id && vapiPhoneNumber.assistantId !== campaign.vapi_assistant_id) {
      await assignAssistantToPhoneNumber(
        vapiPhoneNumber.id,
        campaign.vapi_assistant_id,
        webhookUrl
      );
    }

    // Save to database
    const { data: savedPhone, error: saveError } = await supabase
      .from("campaign_phone_numbers")
      .insert({
        campaign_id: id,
        client_id: campaign.client_id,
        phone_number: provisionedPhoneNumber,
        friendly_name: friendlyName || vapiPhoneNumber.name || provisionedPhoneNumber,
        provider: mode === "vapi" ? "vapi" : "twilio",
        twilio_sid: twilioSid,
        vapi_phone_id: vapiPhoneNumber.id,
        is_provisioned: true,
        is_active: true,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving phone number:", saveError);
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    // Update campaign's primary phone number if this is the first
    const { data: existingNumbers } = await supabase
      .from("campaign_phone_numbers")
      .select("id")
      .eq("campaign_id", id);

    if (!existingNumbers || existingNumbers.length === 1) {
      await supabase
        .from("outbound_campaigns")
        .update({ phone_number_id: savedPhone.id })
        .eq("id", id);
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "phone_number_provisioned",
      resource_type: "campaign_phone_number",
      resource_id: savedPhone.id,
      details: {
        campaign_id: id,
        phone_number: provisionedPhoneNumber,
        mode,
        vapi_phone_id: vapiPhoneNumber.id,
      },
    });

    return NextResponse.json({
      success: true,
      phoneNumber: savedPhone,
      vapiPhoneId: vapiPhoneNumber.id,
    }, { status: 201 });
  } catch (error) {
    console.error("Error provisioning phone number:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to provision phone number" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/outbound-campaigns/[id]/phone-numbers/provision
 * Search available phone numbers to purchase
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

    const { searchParams } = new URL(request.url);
    const areaCode = searchParams.get("areaCode");

    if (!areaCode) {
      return NextResponse.json(
        { error: "Area code is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get campaign's client
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("client_id")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Get client's Twilio credentials
    const twilioKeys = await getClientTwilioKeys(supabase, campaign.client_id);
    if (!twilioKeys) {
      return NextResponse.json(
        { error: "Client Twilio credentials not configured" },
        { status: 400 }
      );
    }

    // Search for available numbers
    const availableNumbers = await searchAvailablePhoneNumbers(
      twilioKeys.accountSid,
      twilioKeys.authToken,
      areaCode,
      20
    );

    return NextResponse.json({ numbers: availableNumbers });
  } catch (error) {
    console.error("Error searching phone numbers:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search phone numbers" },
      { status: 500 }
    );
  }
}
