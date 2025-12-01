import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";

// Lazy init to avoid build-time errors when env var isn't available
function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function GET() {
  try {
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
    const body = await request.json();
    const { name, email, company_name, send_invite } = body;

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

    // Create client
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        name,
        email,
        company_name,
        invited_at: send_invite ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    // Send invitation if requested
    if (send_invite) {
      // Create auth user with magic link
      const { error: authError } = await serviceClient.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?email=${encodeURIComponent(email)}`,
        }
      );

      if (authError) {
        console.error("Auth error:", authError);
        // Still return success but note the invite failed
      }

      // Also send a custom email via Resend if configured
      const resend = getResendClient();
      if (resend) {
        try {
          await resend.emails.send({
            from: "BotMakers <noreply@botmakers.io>",
            to: email,
            subject: "You've been invited to BotMakers Call Analytics",
            html: `
              <h1>Welcome to BotMakers!</h1>
              <p>Hi ${name},</p>
              <p>You've been invited to access the BotMakers Call Analytics platform.</p>
              <p>Click the link in the separate email to set up your account, or use this link:</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/login">Sign in to BotMakers</a></p>
              <p>Best regards,<br>The BotMakers Team</p>
            `,
          });
        } catch (emailError) {
          console.error("Email error:", emailError);
        }
      }
    }

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
