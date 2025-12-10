import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/sms-blacklist
 * Get all phone numbers on the global SMS blacklist
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";

    const offset = (page - 1) * limit;

    const supabase = await createServiceClient();

    let query = supabase
      .from("sms_blacklist")
      .select("*", { count: "exact" })
      .order("opted_out_at", { ascending: false });

    if (search) {
      query = query.ilike("phone_number", `%${search}%`);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching blacklist:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      blacklist: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching SMS blacklist:", error);
    return NextResponse.json(
      { error: "Failed to fetch blacklist" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sms-blacklist
 * Manually add a phone number to the blacklist (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const { phone_number, reason } = body;

    if (!phone_number) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone_number);

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("sms_blacklist")
      .upsert(
        {
          phone_number: formattedPhone,
          is_active: true,
          opted_out_at: new Date().toISOString(),
          opt_out_source: "admin",
          opt_out_reason: reason || "Added by administrator",
          added_by_admin_id: authResult.admin.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "phone_number",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error adding to blacklist:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${formattedPhone} added to SMS blacklist`,
      entry: data,
    });
  } catch (error) {
    console.error("Error adding to SMS blacklist:", error);
    return NextResponse.json(
      { error: "Failed to add to blacklist" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/sms-blacklist
 * Remove a phone number from the blacklist (admin only - allows re-subscription)
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get("phone_number");

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);

    const supabase = await createServiceClient();

    // Instead of deleting, we mark as inactive and log the admin action
    const { data, error } = await supabase
      .from("sms_blacklist")
      .update({
        is_active: false,
        removed_by_admin_id: authResult.admin.id,
        removed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", formattedPhone)
      .select()
      .single();

    if (error) {
      console.error("Error removing from blacklist:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the removal
    await supabase.from("sms_opt_out_log").insert({
      phone_number: formattedPhone,
      action: "admin_remove",
      admin_id: authResult.admin.id,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `${formattedPhone} removed from SMS blacklist`,
      entry: data,
    });
  } catch (error) {
    console.error("Error removing from SMS blacklist:", error);
    return NextResponse.json(
      { error: "Failed to remove from blacklist" },
      { status: 500 }
    );
  }
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }

  if (phone.startsWith("+")) {
    return phone;
  }

  return `+${cleaned}`;
}
