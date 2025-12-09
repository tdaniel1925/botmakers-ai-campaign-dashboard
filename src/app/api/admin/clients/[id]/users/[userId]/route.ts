import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import type { ClientUserRole } from "@/types";

// GET - Get a single client user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id: clientId, userId } = await params;
    const supabase = await createClient();

    const { data: user, error } = await supabase
      .from("client_users")
      .select("*, clients(id, name, company_name)")
      .eq("id", userId)
      .eq("client_id", clientId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching client user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PUT - Update a client user
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id: clientId, userId } = await params;
    const body = await request.json();
    const supabase = await createClient();

    // Verify user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("client_users")
      .select("id, role")
      .eq("id", userId)
      .eq("client_id", clientId)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    // Handle role change
    if (body.role !== undefined) {
      const validRoles: ClientUserRole[] = ["owner", "manager", "member", "viewer"];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json(
          { error: "Invalid role" },
          { status: 400 }
        );
      }

      // If changing to owner, check there's no other owner
      if (body.role === "owner" && existingUser.role !== "owner") {
        const { data: existingOwner } = await supabase
          .from("client_users")
          .select("id")
          .eq("client_id", clientId)
          .eq("role", "owner")
          .neq("id", userId)
          .single();

        if (existingOwner) {
          return NextResponse.json(
            { error: "This client already has an owner. Change the existing owner's role first." },
            { status: 400 }
          );
        }
      }

      updateData.role = body.role;
    }

    const { data: user, error } = await supabase
      .from("client_users")
      .update(updateData)
      .eq("id", userId)
      .eq("client_id", clientId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating client user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a client user
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id: clientId, userId } = await params;
    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    // Get user to check role and get auth_user_id
    const { data: user, error: fetchError } = await supabase
      .from("client_users")
      .select("id, role, auth_user_id, email")
      .eq("id", userId)
      .eq("client_id", clientId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Don't allow deleting the owner
    if (user.role === "owner") {
      return NextResponse.json(
        { error: "Cannot delete the owner. Transfer ownership first by changing another user to owner." },
        { status: 400 }
      );
    }

    // Delete client_users record
    const { error: deleteError } = await supabase
      .from("client_users")
      .delete()
      .eq("id", userId)
      .eq("client_id", clientId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Delete auth user if exists
    if (user.auth_user_id) {
      try {
        await serviceClient.auth.admin.deleteUser(user.auth_user_id);
      } catch (authErr) {
        console.error("Error deleting auth user:", authErr);
        // Don't fail if auth deletion fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
