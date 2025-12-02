import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Lazy init to avoid build-time errors when env vars aren't available
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Verify that the authenticated user's email matches the requested email
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // User must be accepting their own invite
    if (user.email !== email) {
      return NextResponse.json(
        { error: "Unauthorized: Email mismatch" },
        { status: 403 }
      );
    }

    // Use service client to update (bypasses RLS)
    const serviceClient = getServiceClient();

    // Update client's accepted_at timestamp
    const { data: client, error } = await serviceClient
      .from("clients")
      .update({
        accepted_at: new Date().toISOString(),
        is_active: true,
        invite_status: "accepted",
      })
      .eq("email", email)
      .select("id")
      .single();

    if (error) {
      console.error("Accept invite error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invitation accepted successfully",
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
