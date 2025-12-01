import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    // Get client
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Send magic link invitation
    const { error: authError } = await serviceClient.auth.admin.inviteUserByEmail(
      client.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?email=${encodeURIComponent(client.email)}`,
      }
    );

    if (authError) {
      console.error("Auth error:", authError);
    }

    // Send custom email
    try {
      await resend.emails.send({
        from: "BotMakers <noreply@botmakers.io>",
        to: client.email,
        subject: "You've been invited to BotMakers Call Analytics",
        html: `
          <h1>Welcome to BotMakers!</h1>
          <p>Hi ${client.name},</p>
          <p>You've been invited to access the BotMakers Call Analytics platform.</p>
          <p>Click the link in the separate email to set up your account, or use this link:</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/login">Sign in to BotMakers</a></p>
          <p>Best regards,<br>The BotMakers Team</p>
        `,
      });
    } catch (emailError) {
      console.error("Email error:", emailError);
    }

    // Update invited_at timestamp
    await supabase
      .from("clients")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending invite:", error);
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 }
    );
  }
}
