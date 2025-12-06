import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/crm/lists
 * List CRM contact lists
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");

    const supabase = await createClient();

    let query = supabase
      .from("crm_lists")
      .select(`
        *,
        member_count:crm_list_members(count)
      `)
      .order("name");

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data: lists, error } = await query;

    if (error) {
      console.error("Error fetching lists:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform count result
    const transformedLists = (lists || []).map(list => ({
      ...list,
      member_count: Array.isArray(list.member_count) && list.member_count[0]
        ? list.member_count[0].count
        : 0,
    }));

    return NextResponse.json({ lists: transformedLists });
  } catch (error) {
    console.error("Error in lists GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch lists" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/crm/lists
 * Create a new CRM contact list
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const { client_id, name, description, color, is_dynamic, filter_criteria } = body;

    if (!client_id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "List name is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: list, error } = await supabase
      .from("crm_lists")
      .insert({
        client_id,
        name,
        description,
        color: color || "#6366f1",
        is_dynamic: is_dynamic || false,
        filter_criteria: is_dynamic ? filter_criteria : null,
        created_by: authResult.admin!.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating list:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    console.error("Error in lists POST:", error);
    return NextResponse.json(
      { error: "Failed to create list" },
      { status: 500 }
    );
  }
}
