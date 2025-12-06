import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/outbound-campaigns/[id]/phone-numbers
 * List phone numbers assigned to a campaign
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

    const supabase = await createClient();

    // Verify campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, client_id")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Get phone numbers for this campaign
    const { data: phoneNumbers, error } = await supabase
      .from("campaign_phone_numbers")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also get available client phone numbers (not assigned to any campaign)
    const { data: availableNumbers } = await supabase
      .from("campaign_phone_numbers")
      .select("*")
      .eq("client_id", campaign.client_id)
      .is("campaign_id", null)
      .eq("is_active", true);

    return NextResponse.json({
      assigned: phoneNumbers || [],
      available: availableNumbers || [],
    });
  } catch (error) {
    console.error("Error fetching phone numbers:", error);
    return NextResponse.json(
      { error: "Failed to fetch phone numbers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/outbound-campaigns/[id]/phone-numbers
 * Add an existing phone number to a campaign
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
    const { phone_number, friendly_name, provider = "twilio", twilio_sid, vapi_phone_id } = body;

    if (!phone_number) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

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
        { error: "Phone numbers can only be added to draft campaigns" },
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

    // Check if number is already assigned to another campaign
    const { data: existingAssignment } = await supabase
      .from("campaign_phone_numbers")
      .select("id, campaign_id")
      .eq("phone_number", normalizedPhone)
      .not("campaign_id", "is", null)
      .single();

    if (existingAssignment) {
      return NextResponse.json(
        { error: "This phone number is already assigned to another campaign" },
        { status: 409 }
      );
    }

    // Create phone number record
    const { data: phoneNumber, error } = await supabase
      .from("campaign_phone_numbers")
      .insert({
        campaign_id: id,
        client_id: campaign.client_id,
        phone_number: normalizedPhone,
        friendly_name: friendly_name || normalizedPhone,
        provider,
        twilio_sid,
        vapi_phone_id,
        is_provisioned: false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    return NextResponse.json(phoneNumber, { status: 201 });
  } catch (error) {
    console.error("Error adding phone number:", error);
    return NextResponse.json(
      { error: "Failed to add phone number" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/outbound-campaigns/[id]/phone-numbers
 * Remove a phone number from a campaign
 */
export async function DELETE(
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
    const { phone_number_id } = body;

    if (!phone_number_id) {
      return NextResponse.json(
        { error: "Phone number ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify campaign exists and is in draft status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status, phone_number_id")
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
        { error: "Phone numbers can only be removed from draft campaigns" },
        { status: 400 }
      );
    }

    // Remove the assignment (don't delete the number, just unassign it)
    const { error } = await supabase
      .from("campaign_phone_numbers")
      .update({ campaign_id: null })
      .eq("id", phone_number_id)
      .eq("campaign_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If this was the primary phone number, clear it
    if (campaign.phone_number_id === phone_number_id) {
      // Try to set another number as primary
      const { data: remainingNumbers } = await supabase
        .from("campaign_phone_numbers")
        .select("id")
        .eq("campaign_id", id)
        .limit(1)
        .single();

      await supabase
        .from("outbound_campaigns")
        .update({ phone_number_id: remainingNumbers?.id || null })
        .eq("id", id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing phone number:", error);
    return NextResponse.json(
      { error: "Failed to remove phone number" },
      { status: 500 }
    );
  }
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  } else if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}
