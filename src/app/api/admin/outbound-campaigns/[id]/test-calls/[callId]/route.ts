import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/outbound-campaigns/[id]/test-calls/[callId]
 * Get a single test call's details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; callId: string }> }
) {
  try {
    const { id, callId } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createServiceClient();

    // Get the test call with campaign info
    const { data: call, error } = await supabase
      .from("campaign_calls")
      .select(`
        *,
        campaign:outbound_campaigns(
          id,
          name,
          rate_per_minute,
          structured_data_schema
        )
      `)
      .eq("id", callId)
      .eq("campaign_id", id)
      .eq("is_test", true)
      .single();

    if (error) {
      console.error("Error fetching test call:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Test call not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!call) {
      return NextResponse.json({ error: "Test call not found" }, { status: 404 });
    }

    // Get prev/next call IDs for navigation (sorted by created_at desc)
    const { data: prevCall } = await supabase
      .from("campaign_calls")
      .select("id")
      .eq("campaign_id", id)
      .eq("is_test", true)
      .gt("created_at", call.created_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const { data: nextCall } = await supabase
      .from("campaign_calls")
      .select("id")
      .eq("campaign_id", id)
      .eq("is_test", true)
      .lt("created_at", call.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      call,
      navigation: {
        prevId: prevCall?.id || null,
        nextId: nextCall?.id || null,
      }
    });
  } catch (error) {
    console.error("Error fetching test call:", error);
    return NextResponse.json(
      { error: "Failed to fetch test call" },
      { status: 500 }
    );
  }
}
