import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { sendWelcomeEmail } from "@/lib/emails";
import type { ClientUserRole } from "@/types";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// GET - List all users for a client
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id: clientId } = await params;
    const supabase = await createClient();

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: users, error } = await supabase
      .from("client_users")
      .select("*")
      .eq("client_id", clientId)
      .order("role", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching client users:", error);
    return NextResponse.json(
      { error: "Failed to fetch client users" },
      { status: 500 }
    );
  }
}

// POST - Create a new user for a client
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id: clientId } = await params;
    const body = await request.json();
    const { email, name, role, send_invite = false } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: ClientUserRole[] = ["owner", "manager", "member", "viewer"];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be: owner, manager, member, or viewer" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, company_name")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check if user already exists for this client
    const { data: existingUser } = await supabase
      .from("client_users")
      .select("id")
      .eq("client_id", clientId)
      .eq("email", email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists for this client" },
        { status: 409 }
      );
    }

    // Check if role is 'owner' - only one owner allowed
    if (role === "owner") {
      const { data: existingOwner } = await supabase
        .from("client_users")
        .select("id")
        .eq("client_id", clientId)
        .eq("role", "owner")
        .single();

      if (existingOwner) {
        return NextResponse.json(
          { error: "This client already has an owner. Change the existing owner's role first." },
          { status: 400 }
        );
      }
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
      console.error("Auth error creating client user:", authError);
      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 500 }
      );
    }

    // Create client_users record
    const { data: user, error: userError } = await supabase
      .from("client_users")
      .insert({
        client_id: clientId,
        auth_user_id: authUser.user.id,
        email,
        name,
        role: role || "member",
        is_active: true,
        temp_password: tempPassword,
        invited_at: send_invite ? new Date().toISOString() : null,
        invited_by: authResult.admin.id,
      })
      .select()
      .single();

    if (userError) {
      // Rollback: delete auth user
      await serviceClient.auth.admin.deleteUser(authUser.user.id);
      console.error("Error creating client user record:", userError);
      return NextResponse.json(
        { error: "Failed to create user record" },
        { status: 500 }
      );
    }

    // Send welcome email if requested
    if (send_invite) {
      try {
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;
        await sendWelcomeEmail({
          recipientName: name,
          recipientEmail: email,
          username: email,
          tempPassword,
          loginUrl,
          companyName: client.company_name || client.name,
          clientId: clientId,
        });
      } catch (emailErr) {
        console.error("Error sending welcome email:", emailErr);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json(
      {
        ...user,
        tempPassword, // Return for display if needed
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating client user:", error);
    return NextResponse.json(
      { error: "Failed to create client user" },
      { status: 500 }
    );
  }
}
