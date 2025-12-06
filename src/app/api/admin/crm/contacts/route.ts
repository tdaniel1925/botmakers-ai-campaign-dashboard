import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/crm/contacts
 * List CRM contacts with filtering, sorting, and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    const status = searchParams.get("status");
    const pipelineStage = searchParams.get("pipeline_stage");
    const tags = searchParams.get("tags")?.split(",").filter(Boolean);
    const search = searchParams.get("search");
    const assignedTo = searchParams.get("assigned_to");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // Build query
    let query = supabase
      .from("crm_contacts")
      .select(`
        *,
        assigned_admin:admin_users!crm_contacts_assigned_to_fkey(id, name, email)
      `, { count: "exact" });

    // Apply filters
    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (pipelineStage) {
      query = query.eq("pipeline_stage", pipelineStage);
    }

    if (tags && tags.length > 0) {
      query = query.overlaps("tags", tags);
    }

    if (assignedTo) {
      query = query.eq("assigned_to", assignedTo);
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`);
    }

    // Apply sorting
    const ascending = sortOrder === "asc";
    query = query.order(sortBy, { ascending });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: contacts, error, count } = await query;

    if (error) {
      console.error("Error fetching CRM contacts:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      contacts: contacts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in CRM contacts GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/crm/contacts
 * Create a new CRM contact
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
      first_name,
      last_name,
      email,
      phone,
      phone_secondary,
      company,
      job_title,
      website,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      timezone,
      status = "lead",
      lead_source,
      pipeline_stage = "new",
      assigned_to,
      tags = [],
      notes,
      custom_fields = {},
    } = body;

    if (!client_id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        { error: "Either email or phone is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check for duplicates
    if (email) {
      const { data: existing } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("client_id", client_id)
        .eq("email", email)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: "A contact with this email already exists" },
          { status: 409 }
        );
      }
    }

    // Normalize phone number
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;

    // Create contact
    const { data: contact, error } = await supabase
      .from("crm_contacts")
      .insert({
        client_id,
        first_name,
        last_name,
        email,
        phone: normalizedPhone,
        phone_secondary,
        company,
        job_title,
        website,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country: country || "US",
        timezone,
        status,
        lead_source,
        pipeline_stage,
        assigned_to,
        assigned_at: assigned_to ? new Date().toISOString() : null,
        tags,
        notes,
        custom_fields,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating CRM contact:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    await supabase.from("crm_activities").insert({
      contact_id: contact.id,
      client_id,
      activity_type: "note",
      subject: "Contact created",
      body: `Contact was created${lead_source ? ` from ${lead_source}` : ""}`,
      performed_by: authResult.admin!.id,
      performed_by_name: authResult.admin!.name || authResult.admin!.email,
    });

    // Log audit
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "crm_contact_created",
      resource_type: "crm_contact",
      resource_id: contact.id,
      details: { client_id, email, phone: normalizedPhone },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error in CRM contacts POST:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}

function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  } else if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return phone; // Return as-is if can't normalize
}
