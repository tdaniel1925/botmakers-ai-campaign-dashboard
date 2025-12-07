import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/inbound-campaigns/[id]
 * Get a specific inbound campaign
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

    const { data: campaign, error } = await supabase
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
          provider,
          is_active
        ),
        inbound_campaign_outcome_tags (
          id,
          tag_name,
          tag_color,
          is_positive,
          sort_order
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching inbound campaign:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error in inbound campaign GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbound campaign" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/inbound-campaigns/[id]
 * Update an inbound campaign
 */
export async function PATCH(
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
    const {
      name,
      description,
      status,
      agent_config,
      max_call_duration,
      silence_timeout,
      is_active,
      phone_number_id,
    } = body;

    const supabase = await createClient();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (agent_config !== undefined) updateData.agent_config = agent_config;
    if (max_call_duration !== undefined) updateData.max_call_duration = max_call_duration;
    if (silence_timeout !== undefined) updateData.silence_timeout = silence_timeout;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (phone_number_id !== undefined) updateData.phone_number_id = phone_number_id;

    // If activating, set launched_at
    if (status === "active") {
      const { data: existing } = await supabase
        .from("inbound_campaigns")
        .select("launched_at")
        .eq("id", id)
        .single();

      if (!existing?.launched_at) {
        updateData.launched_at = new Date().toISOString();
      }
    }

    const { data: campaign, error } = await supabase
      .from("inbound_campaigns")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 404 }
        );
      }
      console.error("Error updating inbound campaign:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "updated",
      resource_type: "inbound_campaign",
      resource_id: id,
      details: { updated_fields: Object.keys(updateData) },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error updating inbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to update inbound campaign" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/inbound-campaigns/[id]
 * Delete an inbound campaign
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

    const supabase = await createClient();

    // Get campaign info before deletion
    const { data: campaign } = await supabase
      .from("inbound_campaigns")
      .select("name, client_id")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("inbound_campaigns")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting inbound campaign:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the action
    if (campaign) {
      await supabase.from("audit_logs").insert({
        user_id: authResult.admin!.id,
        user_type: "admin",
        user_email: authResult.admin!.email,
        action: "deleted",
        resource_type: "inbound_campaign",
        resource_id: id,
        details: { campaign_name: campaign.name },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting inbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to delete inbound campaign" },
      { status: 500 }
    );
  }
}
