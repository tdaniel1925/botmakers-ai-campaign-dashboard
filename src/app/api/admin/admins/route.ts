import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import type { AdminRole } from "@/types";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// GET - List all admin users
export async function GET() {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    // Only super_admin can view admin list
    if (authResult.admin.role !== "super_admin") {
      return forbiddenResponse("Only super admins can manage other admins");
    }

    const supabase = await createClient();

    const { data: admins, error } = await supabase
      .from("admin_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    return NextResponse.json(
      { error: "Failed to fetch admins" },
      { status: 500 }
    );
  }
}

// POST - Create a new admin user
export async function POST(request: Request) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    // Only super_admin can create other admins
    if (authResult.admin.role !== "super_admin") {
      return forbiddenResponse("Only super admins can create other admins");
    }

    const body = await request.json();
    const { email, name, role } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: AdminRole[] = ["super_admin", "admin", "viewer"];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be: super_admin, admin, or viewer" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    // Check if admin already exists
    const { data: existingAdmin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingAdmin) {
      return NextResponse.json(
        { error: "An admin with this email already exists" },
        { status: 409 }
      );
    }

    // Check if auth user exists
    const { data: authUsers } = await serviceClient.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingAuthUser) {
      return NextResponse.json(
        { error: "A user with this email already exists in the system" },
        { status: 409 }
      );
    }

    // Generate temp password
    const tempPassword = generateTempPassword();

    // Create auth user
    const { data: authUser, error: authError } =
      await serviceClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      console.error("Auth error creating admin:", authError);
      return NextResponse.json(
        { error: "Failed to create admin user" },
        { status: 500 }
      );
    }

    // Create admin_users record
    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .insert({
        id: authUser.user.id,
        email,
        name,
        role: role || "admin",
        is_active: true,
        invited_by: authResult.admin.id,
      })
      .select()
      .single();

    if (adminError) {
      // Rollback: delete auth user
      await serviceClient.auth.admin.deleteUser(authUser.user.id);
      console.error("Error creating admin record:", adminError);
      return NextResponse.json(
        { error: "Failed to create admin record" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ...admin,
        tempPassword, // Return temp password for display
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating admin:", error);
    return NextResponse.json(
      { error: "Failed to create admin" },
      { status: 500 }
    );
  }
}
