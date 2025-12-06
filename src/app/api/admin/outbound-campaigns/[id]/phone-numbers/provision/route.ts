import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { getApiKeys } from "@/lib/api-keys";

/**
 * POST /api/admin/outbound-campaigns/[id]/phone-numbers/provision
 * Auto-provision a new phone number from Twilio
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
    const { area_code, country = "US" } = body;

    const supabase = await createClient();

    // Verify campaign exists and is in draft status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status, client_id")
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

    // Get Twilio credentials
    let twilioAccountSid: string;
    let twilioAuthToken: string;

    // First check if client has their own Twilio keys
    const { data: clientApiKey } = await supabase
      .from("client_api_keys")
      .select("api_key, api_secret, account_sid")
      .eq("client_id", campaign.client_id)
      .eq("provider", "twilio")
      .eq("is_active", true)
      .single();

    if (clientApiKey && clientApiKey.account_sid && clientApiKey.api_secret) {
      twilioAccountSid = clientApiKey.account_sid;
      twilioAuthToken = clientApiKey.api_secret;
    } else {
      // Use system Twilio credentials
      const twilioKeys = await getApiKeys("twilio");
      if (!twilioKeys?.accountSid || !twilioKeys?.authToken) {
        return NextResponse.json(
          { error: "Twilio API not configured" },
          { status: 500 }
        );
      }
      twilioAccountSid = twilioKeys.accountSid;
      twilioAuthToken = twilioKeys.authToken;
    }

    // Search for available numbers
    const searchParams = new URLSearchParams({
      VoiceEnabled: "true",
      SmsEnabled: "true",
    });

    if (area_code) {
      searchParams.set("AreaCode", area_code);
    }

    const searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/${country}/Local.json?${searchParams}`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
      },
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json().catch(() => ({}));
      console.error("Twilio search error:", errorData);
      return NextResponse.json(
        { error: "Failed to search for available numbers" },
        { status: 500 }
      );
    }

    const searchData = await searchResponse.json();
    const availableNumbers = searchData.available_phone_numbers || [];

    if (availableNumbers.length === 0) {
      return NextResponse.json(
        { error: `No phone numbers available${area_code ? ` in area code ${area_code}` : ""}` },
        { status: 404 }
      );
    }

    // Purchase the first available number
    const numberToPurchase = availableNumbers[0];
    const purchaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;

    const purchaseResponse = await fetch(purchaseUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        PhoneNumber: numberToPurchase.phone_number,
        FriendlyName: `Outbound Campaign - ${campaign.id.slice(0, 8)}`,
      }),
    });

    if (!purchaseResponse.ok) {
      const errorData = await purchaseResponse.json().catch(() => ({}));
      console.error("Twilio purchase error:", errorData);
      return NextResponse.json(
        { error: "Failed to purchase phone number" },
        { status: 500 }
      );
    }

    const purchaseData = await purchaseResponse.json();

    // Save the phone number to database
    const { data: phoneNumber, error: saveError } = await supabase
      .from("campaign_phone_numbers")
      .insert({
        campaign_id: id,
        client_id: campaign.client_id,
        phone_number: purchaseData.phone_number,
        friendly_name: purchaseData.friendly_name,
        provider: "twilio",
        twilio_sid: purchaseData.sid,
        is_provisioned: true,
        is_active: true,
        capabilities: {
          voice: purchaseData.capabilities?.voice || true,
          sms: purchaseData.capabilities?.sms || true,
        },
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving phone number:", saveError);
      // Note: Number was purchased but not saved - admin should handle manually
      return NextResponse.json(
        {
          error: "Number purchased but failed to save. Contact support.",
          twilio_sid: purchaseData.sid,
          phone_number: purchaseData.phone_number,
        },
        { status: 500 }
      );
    }

    // Update campaign's phone_number_id if this is the first number
    const { data: existingNumbers } = await supabase
      .from("campaign_phone_numbers")
      .select("id")
      .eq("campaign_id", id);

    if (!existingNumbers || existingNumbers.length === 1) {
      await supabase
        .from("outbound_campaigns")
        .update({ phone_number_id: phoneNumber.id })
        .eq("id", id);
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "phone_number_provisioned",
      resource_type: "campaign_phone_number",
      resource_id: phoneNumber.id,
      details: {
        campaign_id: id,
        phone_number: purchaseData.phone_number,
        twilio_sid: purchaseData.sid,
        area_code: area_code || null,
      },
    });

    return NextResponse.json({
      success: true,
      phone_number: phoneNumber,
    });
  } catch (error) {
    console.error("Error provisioning phone number:", error);
    return NextResponse.json(
      { error: "Failed to provision phone number" },
      { status: 500 }
    );
  }
}
