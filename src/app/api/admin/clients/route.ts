import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateUsername, generateTempPassword } from "@/lib/credentials";
import { sendWelcomeEmail } from "@/lib/emails";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

export async function GET() {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createClient();

    const { data: clients, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const { name, email, company_name, billing_tier, billing_notes, send_invite, save_as_draft } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    // Check if client already exists
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "A client with this email already exists" },
        { status: 400 }
      );
    }

    // Get existing usernames to avoid duplicates
    const { data: existingClients } = await supabase
      .from("clients")
      .select("username");
    const existingUsernames = (existingClients || [])
      .map((c) => c.username)
      .filter(Boolean) as string[];

    // Generate credentials
    const username = generateUsername(name, existingUsernames);
    const tempPassword = generateTempPassword();

    // Determine invite status
    let inviteStatus = "draft";
    if (send_invite) {
      inviteStatus = "sent";
    } else if (!save_as_draft) {
      inviteStatus = "pending";
    }

    // Create client with credentials
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        name,
        email,
        company_name,
        username,
        temp_password: tempPassword,
        invite_status: inviteStatus,
        invited_at: send_invite ? new Date().toISOString() : null,
        billing_tier: billing_tier || "standard",
        billing_notes: billing_notes || null,
      })
      .select()
      .single();

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    // Create auth user if sending invite
    if (send_invite) {
      // Create user in Supabase Auth with the temp password
      const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name,
          client_id: client.id,
          must_change_password: true,
        },
      });

      if (authError) {
        console.error("Auth error:", authError);
        // Update invite status to reflect the failure
        await supabase
          .from("clients")
          .update({ invite_status: "pending" })
          .eq("id", client.id);
      } else {
        // Send welcome email with credentials
        const emailResult = await sendWelcomeEmail({
          clientId: client.id,
          recipientName: name,
          username,
          tempPassword,
          loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
          companyName: "BotMakers",
        });

        if (!emailResult.success) {
          console.error("Email error:", emailResult.error);
        }

        // Store the auth user ID reference (don't update primary key)
        if (authUser?.user) {
          await supabase
            .from("clients")
            .update({ auth_user_id: authUser.user.id })
            .eq("id", client.id);
        }
      }
    }

    // Return client data without exposing password (only show username for draft saves)
    return NextResponse.json({
      ...client,
      username,
      // Only include temp_password for draft saves (not sent invites)
      // The password is sent via email for invites
      ...(save_as_draft ? { temp_password: tempPassword } : {}),
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
