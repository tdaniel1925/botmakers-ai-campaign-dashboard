import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

// Lazy init to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Fetch email logs with pagination and filtering
export async function GET(request: Request) {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const templateSlug = searchParams.get("template");
    const clientId = searchParams.get("clientId");
    const search = searchParams.get("search");

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("email_logs")
      .select(`
        *,
        client:clients(id, name, email, company_name)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (templateSlug) {
      query = query.eq("template_slug", templateSlug);
    }
    if (clientId) {
      query = query.eq("client_id", clientId);
    }
    if (search) {
      query = query.or(`recipient_email.ilike.%${search}%,recipient_name.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching email logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch email logs" },
      { status: 500 }
    );
  }
}
