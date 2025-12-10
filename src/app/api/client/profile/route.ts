import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/client/profile
 * Get client profile information
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = await createServiceClient();
    const { data: client, error } = await serviceClient
      .from("clients")
      .select("*")
      .eq("email", user.email)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

/**
 * PUT /api/client/profile
 * Update client profile information
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      company_name,
      phone,
      address,
      city,
      state,
      zip,
      country,
      timezone,
    } = body;

    const serviceClient = await createServiceClient();

    // Get client ID first
    const { data: existingClient } = await serviceClient
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Update client profile
    const { data: client, error } = await serviceClient
      .from("clients")
      .update({
        name,
        company_name,
        phone,
        address,
        city,
        state,
        zip,
        country,
        timezone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingClient.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating profile:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
