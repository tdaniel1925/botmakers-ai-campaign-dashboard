import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getClientId } from "@/lib/client-auth";

/**
 * GET /api/client/outbound-campaigns/[id]/contacts
 * List contacts for a campaign (client-facing)
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const outcome = searchParams.get("outcome");

    // Build query
    let query = supabase
      .from("campaign_contacts")
      .select("*", { count: "exact" })
      .eq("campaign_id", id)
      .order("created_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (outcome) {
      query = query.eq("outcome", outcome);
    }
    if (search) {
      query = query.or(
        `phone_number.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: contacts, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/client/outbound-campaigns/[id]/contacts
 * Add a single contact to a campaign (client-facing)
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
    const { phone_number, first_name, last_name, email, custom_data } = body;

    if (!phone_number) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Verify campaign exists, belongs to client, and is in draft/paused status
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

    if (campaign.status !== "draft" && campaign.status !== "paused") {
      return NextResponse.json(
        { error: "Contacts can only be added to draft or paused campaigns" },
        { status: 400 }
      );
    }

    // Normalize phone number to E.164 format
    const normalizedPhone = normalizePhoneNumber(phone_number);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    // Insert contact
    const { data: contact, error } = await supabase
      .from("campaign_contacts")
      .insert({
        campaign_id: id,
        phone_number: normalizedPhone,
        first_name,
        last_name,
        email,
        custom_data: custom_data || {},
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This phone number is already in the campaign" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update campaign contact count
    await supabase.rpc("increment_campaign_contacts", { campaign_id: id });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error adding contact:", error);
    return NextResponse.json(
      { error: "Failed to add contact" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/client/outbound-campaigns/[id]/contacts
 * Bulk delete contacts from a campaign (client-facing)
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
    const { contact_ids, delete_all_pending } = body;

    // Verify campaign exists, belongs to client, and is in draft/paused status
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

    if (campaign.status !== "draft" && campaign.status !== "paused") {
      return NextResponse.json(
        { error: "Contacts can only be deleted from draft or paused campaigns" },
        { status: 400 }
      );
    }

    let deletedCount = 0;

    if (delete_all_pending) {
      // Count pending contacts first
      const { count } = await supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", "pending");

      // Delete all pending contacts
      const { error } = await supabase
        .from("campaign_contacts")
        .delete()
        .eq("campaign_id", id)
        .eq("status", "pending");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      deletedCount = count || 0;
    } else if (contact_ids && contact_ids.length > 0) {
      // Count matching contacts first
      const { count } = await supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", "pending")
        .in("id", contact_ids);

      // Delete specific contacts (only pending ones)
      const { error } = await supabase
        .from("campaign_contacts")
        .delete()
        .eq("campaign_id", id)
        .eq("status", "pending")
        .in("id", contact_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      deletedCount = count || 0;
    } else {
      return NextResponse.json(
        { error: "Either contact_ids or delete_all_pending must be provided" },
        { status: 400 }
      );
    }

    // Update campaign total_contacts count after deletion
    if (deletedCount > 0) {
      const { count: newTotal } = await supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id);

      await supabase
        .from("outbound_campaigns")
        .update({
          total_contacts: newTotal || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
    });
  } catch (error) {
    console.error("Error deleting contacts:", error);
    return NextResponse.json(
      { error: "Failed to delete contacts" },
      { status: 500 }
    );
  }
}

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX)
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
