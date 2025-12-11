import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getClientId } from "@/lib/client-auth";

/**
 * GET /api/client/outbound-campaigns/[id]/phone-numbers
 * List phone numbers for a campaign (client-facing)
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

    // Verify campaign belongs to this client
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id")
      .eq("id", id)
      .eq("client_id", clientId)
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
      .eq("client_id", clientId)
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
 * POST /api/client/outbound-campaigns/[id]/phone-numbers
 * Add an existing phone number to a campaign (client-facing)
 */
export async function POST(
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

    const body = await request.json();
    const { phone_number_id } = body;

    if (!phone_number_id) {
      return NextResponse.json(
        { error: "Phone number ID is required" },
        { status: 400 }
      );
    }

    // Verify campaign exists, belongs to client, and is in draft status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status")
      .eq("id", id)
      .eq("client_id", clientId)
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

    // Verify the phone number belongs to the client and is available
    const { data: phoneNumber, error: phoneError } = await supabase
      .from("campaign_phone_numbers")
      .select("id, phone_number, campaign_id")
      .eq("id", phone_number_id)
      .eq("client_id", clientId)
      .single();

    if (phoneError || !phoneNumber) {
      return NextResponse.json(
        { error: "Phone number not found" },
        { status: 404 }
      );
    }

    if (phoneNumber.campaign_id && phoneNumber.campaign_id !== id) {
      return NextResponse.json(
        { error: "This phone number is already assigned to another campaign" },
        { status: 409 }
      );
    }

    // Assign the phone number to this campaign
    const { data: updatedPhone, error: updateError } = await supabase
      .from("campaign_phone_numbers")
      .update({
        campaign_id: id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", phone_number_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update campaign's phone_number_id if this is the first number
    const { data: existingNumbers } = await supabase
      .from("campaign_phone_numbers")
      .select("id")
      .eq("campaign_id", id);

    if (!existingNumbers || existingNumbers.length === 1) {
      await supabase
        .from("outbound_campaigns")
        .update({ phone_number_id: updatedPhone.id })
        .eq("id", id);
    }

    return NextResponse.json(updatedPhone);
  } catch (error) {
    console.error("Error adding phone number:", error);
    return NextResponse.json(
      { error: "Failed to add phone number" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/client/outbound-campaigns/[id]/phone-numbers
 * Remove a phone number from a campaign (client-facing)
 */
export async function DELETE(
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

    const body = await request.json();
    const { phone_number_id } = body;

    if (!phone_number_id) {
      return NextResponse.json(
        { error: "Phone number ID is required" },
        { status: 400 }
      );
    }

    // Verify campaign exists, belongs to client, and is in draft status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status, phone_number_id")
      .eq("id", id)
      .eq("client_id", clientId)
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
      .eq("campaign_id", id)
      .eq("client_id", clientId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If this was the primary phone number, clear it or set another
    if (campaign.phone_number_id === phone_number_id) {
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
