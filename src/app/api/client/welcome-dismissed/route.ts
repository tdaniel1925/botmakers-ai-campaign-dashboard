import { NextRequest, NextResponse } from "next/server";
import { getClientId } from "@/lib/client-auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/client/welcome-dismissed
 * Check if the current client has dismissed the welcome message
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getClientId(request);
    if (!authResult.authenticated || !authResult.clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    const { data: client, error } = await supabase
      .from("clients")
      .select("welcome_dismissed_at")
      .eq("id", authResult.clientId)
      .single();

    if (error) {
      console.error("Error fetching welcome status:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      dismissed: !!client?.welcome_dismissed_at,
      dismissedAt: client?.welcome_dismissed_at || null,
    });
  } catch (error) {
    console.error("Error checking welcome dismissed status:", error);
    return NextResponse.json(
      { error: "Failed to check welcome status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/client/welcome-dismissed
 * Mark the welcome message as dismissed for the current client
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getClientId(request);
    if (!authResult.authenticated || !authResult.clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    const { error } = await supabase
      .from("clients")
      .update({
        welcome_dismissed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", authResult.clientId);

    if (error) {
      console.error("Error dismissing welcome message:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      dismissedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error dismissing welcome message:", error);
    return NextResponse.json(
      { error: "Failed to dismiss welcome message" },
      { status: 500 }
    );
  }
}
