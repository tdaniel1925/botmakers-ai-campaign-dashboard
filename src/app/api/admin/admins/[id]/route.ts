import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import type { AdminRole } from "@/types";

// GET - Get a single admin
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    // Only super_admin can view other admins, but anyone can view themselves
    const { id } = await params;
    if (authResult.admin.role !== "super_admin" && authResult.admin.id !== id) {
      return forbiddenResponse("Only super admins can view other admins");
    }

    const supabase = await createClient();

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    return NextResponse.json(admin);
  } catch (error) {
    console.error("Error fetching admin:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin" },
      { status: 500 }
    );
  }
}

// PUT - Update an admin
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id } = await params;

    // Only super_admin can edit other admins
    if (authResult.admin.role !== "super_admin" && authResult.admin.id !== id) {
      return forbiddenResponse("Only super admins can edit other admins");
    }

    // Non-super admins can only edit their own name
    const body = await request.json();
    const supabase = await createClient();

    // Build update object based on permissions
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Everyone can update their own name
    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    // Only super_admin can change role and is_active
    if (authResult.admin.role === "super_admin") {
      if (body.role !== undefined) {
        const validRoles: AdminRole[] = ["super_admin", "admin", "viewer"];
        if (!validRoles.includes(body.role)) {
          return NextResponse.json(
            { error: "Invalid role" },
            { status: 400 }
          );
        }
        updateData.role = body.role;
      }

      if (body.is_active !== undefined) {
        // Prevent deactivating yourself
        if (id === authResult.admin.id && body.is_active === false) {
          return NextResponse.json(
            { error: "You cannot deactivate yourself" },
            { status: 400 }
          );
        }
        updateData.is_active = body.is_active;
      }
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(admin);
  } catch (error) {
    console.error("Error updating admin:", error);
    return NextResponse.json(
      { error: "Failed to update admin" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    // Only super_admin can delete admins
    if (authResult.admin.role !== "super_admin") {
      return forbiddenResponse("Only super admins can delete admins");
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === authResult.admin.id) {
      return NextResponse.json(
        { error: "You cannot delete yourself" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    // Get admin to check if exists
    const { data: admin, error: fetchError } = await supabase
      .from("admin_users")
      .select("id, email")
      .eq("id", id)
      .single();

    if (fetchError || !admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Delete admin_users record
    const { error: deleteError } = await supabase
      .from("admin_users")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Delete auth user
    try {
      await serviceClient.auth.admin.deleteUser(id);
    } catch (authErr) {
      console.error("Error deleting auth user:", authErr);
      // Don't fail the request if auth deletion fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting admin:", error);
    return NextResponse.json(
      { error: "Failed to delete admin" },
      { status: 500 }
    );
  }
}
