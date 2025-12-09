import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateTempPassword } from "@/lib/credentials";
import { sendWelcomeEmail, sendReInviteEmail } from "@/lib/emails";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { regeneratePassword = false, isResend = false } = body;

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

    let tempPassword = client.temp_password;
    // Use email as username for login
    const username = client.email;

    // Generate new password if requested or if none exists
    if (regeneratePassword || !tempPassword) {
      tempPassword = generateTempPassword();
      await supabase
        .from("clients")
        .update({ temp_password: tempPassword })
        .eq("id", id);
    }

    // Check if auth user exists
    const { data: authUsers } = await serviceClient.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find((u) => u.email === client.email);

    if (existingAuthUser) {
      // Update password if regenerated
      if (regeneratePassword || !client.temp_password) {
        await serviceClient.auth.admin.updateUserById(existingAuthUser.id, {
          password: tempPassword,
          user_metadata: {
            ...existingAuthUser.user_metadata,
            must_change_password: true,
          },
        });
      }
    } else {
      // Create auth user
      const { error: authError } = await serviceClient.auth.admin.createUser({
        email: client.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: client.name,
          client_id: client.id,
          must_change_password: true,
        },
      });

      if (authError) {
        console.error("Auth error:", authError);
        return NextResponse.json(
          { error: "Failed to create user account" },
          { status: 500 }
        );
      }
    }

    // Send appropriate email
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;

    let emailResult;
    if (isResend && client.invite_status === "sent") {
      // Send re-invite email
      emailResult = await sendReInviteEmail({
        clientId: client.id,
        recipientEmail: client.email,
        recipientName: client.name,
        username,
        tempPassword,
        loginUrl,
        companyName: "BotMakers",
      });
    } else {
      // Send welcome email
      emailResult = await sendWelcomeEmail({
        clientId: client.id,
        recipientName: client.name,
        recipientEmail: client.email,
        username,
        tempPassword,
        loginUrl,
        companyName: "BotMakers",
      });
    }

    if (!emailResult.success) {
      console.error("Email error:", emailResult.error);
      return NextResponse.json(
        { error: "Failed to send email: " + emailResult.error },
        { status: 500 }
      );
    }

    // Update client invite status
    await supabase
      .from("clients")
      .update({
        invite_status: "sent",
        invited_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      message: isResend ? "Re-invite sent successfully" : "Invite sent successfully",
    });
  } catch (error) {
    console.error("Error sending invite:", error);
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 }
    );
  }
}
