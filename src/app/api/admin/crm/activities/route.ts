import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/crm/activities
 * List CRM activities with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contact_id");
    const clientId = searchParams.get("client_id");
    const activityType = searchParams.get("activity_type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    let query = supabase
      .from("crm_activities")
      .select(`
        *,
        contact:crm_contacts(id, first_name, last_name, email)
      `, { count: "exact" });

    if (contactId) {
      query = query.eq("contact_id", contactId);
    }

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    if (activityType) {
      query = query.eq("activity_type", activityType);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: activities, error, count } = await query;

    if (error) {
      console.error("Error fetching activities:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      activities: activities || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in activities GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/crm/activities
 * Create a new CRM activity
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const {
      contact_id,
      client_id,
      activity_type,
      subject,
      body: activityBody,
      scheduled_at,
      completed_at,
      outcome,
      metadata,
    } = body;

    if (!contact_id || !client_id) {
      return NextResponse.json(
        { error: "Contact ID and Client ID are required" },
        { status: 400 }
      );
    }

    if (!activity_type) {
      return NextResponse.json(
        { error: "Activity type is required" },
        { status: 400 }
      );
    }

    const validTypes = ["call", "email", "sms", "meeting", "note", "task"];
    if (!validTypes.includes(activity_type)) {
      return NextResponse.json(
        { error: `Invalid activity type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify contact exists
    const { data: contact, error: contactError } = await supabase
      .from("crm_contacts")
      .select("id")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    const { data: activity, error } = await supabase
      .from("crm_activities")
      .insert({
        contact_id,
        client_id,
        activity_type,
        subject,
        body: activityBody,
        scheduled_at,
        completed_at,
        outcome,
        metadata,
        performed_by: authResult.admin!.id,
        performed_by_name: authResult.admin!.name || authResult.admin!.email,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating activity:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Error in activities POST:", error);
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 }
    );
  }
}
