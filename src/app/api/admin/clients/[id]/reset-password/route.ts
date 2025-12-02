import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateTempPassword } from "@/lib/credentials";
import { sendPasswordResetEmail } from "@/lib/emails";
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

    // Generate new password
    const newTempPassword = generateTempPassword();

    // Update client record
    await supabase
      .from("clients")
      .update({
        temp_password: newTempPassword,
        password_changed_at: null, // Reset so they must change again
      })
      .eq("id", id);

    // Update auth user password
    const { data: authUsers } = await serviceClient.auth.admin.listUsers();
    const authUser = authUsers?.users?.find((u) => u.email === client.email);

    if (authUser) {
      await serviceClient.auth.admin.updateUserById(authUser.id, {
        password: newTempPassword,
        user_metadata: {
          ...authUser.user_metadata,
          must_change_password: true,
        },
      });
    } else {
      // Create auth user if doesn't exist
      await serviceClient.auth.admin.createUser({
        email: client.email,
        password: newTempPassword,
        email_confirm: true,
        user_metadata: {
          name: client.name,
          client_id: client.id,
          must_change_password: true,
        },
      });
    }

    // Send password reset email
    const emailResult = await sendPasswordResetEmail({
      clientId: client.id,
      recipientEmail: client.email,
      recipientName: client.name,
      username: client.username,
      newTempPassword,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      companyName: "BotMakers",
    });

    if (!emailResult.success) {
      console.error("Email error:", emailResult.error);
      // Return error - don't expose password in response
      return NextResponse.json({
        success: false,
        error: "Password reset but email failed to send. Please try again or contact support.",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Password reset and email sent successfully",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
