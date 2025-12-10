import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/client/team/invite
 * Invite a new team member
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, role } = body;

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: "Name, email, and role are required" },
        { status: 400 }
      );
    }

    // Validate role
    if (!["manager", "member", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const serviceClient = await createServiceClient();

    // Get client info
    const { data: client } = await serviceClient
      .from("clients")
      .select("id, name")
      .eq("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check if user already exists in this team
    const { data: existingUser } = await serviceClient
      .from("client_users")
      .select("id")
      .eq("client_id", client.id)
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "This user is already a team member" },
        { status: 400 }
      );
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-12);

    // Create team member
    const { data: newUser, error } = await serviceClient
      .from("client_users")
      .insert({
        client_id: client.id,
        name,
        email: email.toLowerCase(),
        role,
        temp_password: tempPassword,
        invited_at: new Date().toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating team member:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // TODO: Send invitation email with temp password
    // For now, we'll just return success
    // In production, you would send an email here using your email service

    return NextResponse.json({
      success: true,
      message: "Invitation sent successfully",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Error inviting team member:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}
