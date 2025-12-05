import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    // Get current session and refresh it
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      console.error("Session refresh error:", error);
      return NextResponse.json(
        { error: "Failed to extend session" },
        { status: 401 }
      );
    }

    if (!data.session) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      expiresAt: data.session.expires_at,
    });
  } catch (error) {
    console.error("Session extend error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
