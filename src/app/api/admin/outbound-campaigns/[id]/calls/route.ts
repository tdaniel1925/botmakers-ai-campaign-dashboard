import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/outbound-campaigns/[id]/calls
 * Get all calls for an outbound campaign
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status");
    const outcome = searchParams.get("outcome");
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("campaign_calls")
      .select(`
        *,
        campaign_contacts (
          id,
          phone_number,
          first_name,
          last_name,
          email
        )
      `, { count: "exact" })
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Apply outcome filter if provided
    if (outcome && outcome !== "all") {
      query = query.eq("outcome", outcome);
    }

    const { data: calls, error, count } = await query;

    if (error) {
      console.error("Error fetching calls:", error);
      return NextResponse.json(
        { error: "Failed to fetch calls" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      calls: calls || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Error in calls GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
