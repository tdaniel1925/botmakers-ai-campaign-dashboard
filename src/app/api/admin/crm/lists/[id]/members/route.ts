import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/crm/lists/[id]/members
 * List members of a contact list
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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // Get list members with contact details
    const { data: members, error, count } = await supabase
      .from("crm_list_members")
      .select(`
        id,
        added_at,
        contact:crm_contacts(
          id,
          first_name,
          last_name,
          email,
          phone,
          company,
          status,
          pipeline_stage
        )
      `, { count: "exact" })
      .eq("list_id", id)
      .order("added_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching list members:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      members: members || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in list members GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch list members" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/crm/lists/[id]/members
 * Add contacts to a list
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
    const { contact_ids } = body;

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json(
        { error: "Contact IDs array is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify list exists
    const { data: list, error: listError } = await supabase
      .from("crm_lists")
      .select("id, is_dynamic")
      .eq("id", id)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (list.is_dynamic) {
      return NextResponse.json(
        { error: "Cannot manually add contacts to a dynamic list" },
        { status: 400 }
      );
    }

    // Get existing members to avoid duplicates
    const { data: existingMembers } = await supabase
      .from("crm_list_members")
      .select("contact_id")
      .eq("list_id", id)
      .in("contact_id", contact_ids);

    const existingIds = new Set((existingMembers || []).map(m => m.contact_id));
    const newContactIds = contact_ids.filter((cid: string) => !existingIds.has(cid));

    if (newContactIds.length === 0) {
      return NextResponse.json({
        success: true,
        added: 0,
        skipped: contact_ids.length,
        message: "All contacts are already in the list",
      });
    }

    // Add new members
    const membersToInsert = newContactIds.map((contactId: string) => ({
      list_id: id,
      contact_id: contactId,
    }));

    const { error: insertError } = await supabase
      .from("crm_list_members")
      .insert(membersToInsert);

    if (insertError) {
      console.error("Error adding list members:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      added: newContactIds.length,
      skipped: contact_ids.length - newContactIds.length,
    });
  } catch (error) {
    console.error("Error in list members POST:", error);
    return NextResponse.json(
      { error: "Failed to add contacts to list" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/crm/lists/[id]/members
 * Remove contacts from a list
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

    const { searchParams } = new URL(request.url);
    const contactIds = searchParams.get("contact_ids")?.split(",").filter(Boolean);

    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json(
        { error: "Contact IDs are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("crm_list_members")
      .delete()
      .eq("list_id", id)
      .in("contact_id", contactIds);

    if (error) {
      console.error("Error removing list members:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      removed: contactIds.length,
    });
  } catch (error) {
    console.error("Error in list members DELETE:", error);
    return NextResponse.json(
      { error: "Failed to remove contacts from list" },
      { status: 500 }
    );
  }
}
