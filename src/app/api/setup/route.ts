import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, password, name, setupToken } = await request.json();

    // Security: Check if admin already exists - if so, require setup token
    const { data: existingAdmins } = await supabase
      .from("admin_users")
      .select("id")
      .limit(1);

    if (existingAdmins && existingAdmins.length > 0) {
      // Admin already exists - require SETUP_TOKEN env var to create more
      const validToken = process.env.SETUP_TOKEN;
      if (!validToken || setupToken !== validToken) {
        return NextResponse.json(
          { error: "Setup is disabled. An admin account already exists." },
          { status: 403 }
        );
      }
    }

    // First check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      // User exists, just use their ID
      userId = existingUser.id;

      // Update password if provided
      if (password) {
        await supabase.auth.admin.updateUserById(userId, { password });
      }
    } else {
      // Create new user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: 400 }
        );
      }

      if (!authData.user) {
        return NextResponse.json(
          { error: "Failed to create user" },
          { status: 500 }
        );
      }

      userId = authData.user.id;
    }

    // Check if already in admin_users
    const { data: existingAdmin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", userId)
      .single();

    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: "Admin user already exists",
        userId,
      });
    }

    // Add to admin_users table
    const { error: adminError } = await supabase
      .from("admin_users")
      .insert({
        id: userId,
        email: email,
        name: name,
      });

    if (adminError) {
      return NextResponse.json(
        { error: adminError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admin user created successfully",
      userId,
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
