import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/crm/tags
 * List CRM tags
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
      .from("crm_tags")
      .select("*")
      .order("name");

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data: tags, error } = await query;

    if (error) {
      console.error("Error fetching tags:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tags: tags || [] });
  } catch (error) {
    console.error("Error in tags GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/crm/tags
 * Create a new CRM tag
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const { client_id, name, color, description } = body;

    if (!client_id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check for existing tag with same name
    const { data: existing } = await supabase
      .from("crm_tags")
      .select("id")
      .eq("client_id", client_id)
      .eq("name", name)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 409 }
      );
    }

    const { data: tag, error } = await supabase
      .from("crm_tags")
      .insert({
        client_id,
        name,
        color: color || "#6366f1", // Default indigo
        description,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating tag:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error("Error in tags POST:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/crm/tags
 * Delete a CRM tag
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("id");

    if (!tagId) {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("crm_tags")
      .delete()
      .eq("id", tagId);

    if (error) {
      console.error("Error deleting tag:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in tags DELETE:", error);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
