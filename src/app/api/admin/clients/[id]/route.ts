import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

export async function GET(
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

    const { data: client, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await request.json();
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.company_name !== undefined) updateData.company_name = body.company_name;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.report_frequency !== undefined) updateData.report_frequency = body.report_frequency;
    if (body.report_day_of_week !== undefined) updateData.report_day_of_week = body.report_day_of_week;
    if (body.report_hour !== undefined) updateData.report_hour = body.report_hour;
    if (body.billing_tier !== undefined) updateData.billing_tier = body.billing_tier;
    if (body.billing_notes !== undefined) updateData.billing_notes = body.billing_notes;

    const { data: client, error } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Get client to find auth_user_id
    const { data: client } = await supabase
      .from("clients")
      .select("auth_user_id, email")
      .eq("id", id)
      .single();

    // Delete related data in order (respecting foreign key constraints)
    // 1. Delete calls associated with this client's campaigns
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id")
      .eq("client_id", id);

    if (campaigns && campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id);
      await supabase.from("calls").delete().in("campaign_id", campaignIds);
    }

    // 2. Delete inbound campaigns
    await supabase.from("inbound_campaigns").delete().eq("client_id", id);

    // 3. Delete outbound campaigns
    await supabase.from("campaigns").delete().eq("client_id", id);

    // 4. Delete email logs
    await supabase.from("email_logs").delete().eq("client_id", id);

    // 5. Delete notifications
    await supabase.from("notifications").delete().eq("client_id", id);

    // 6. Delete the client record
    const { error } = await supabase.from("clients").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 7. Delete auth user if exists
    if (client?.auth_user_id) {
      try {
        await serviceClient.auth.admin.deleteUser(client.auth_user_id);
      } catch (authErr) {
        console.error("Error deleting auth user:", authErr);
        // Don't fail the request if auth user deletion fails
      }
    } else if (client?.email) {
      // Try to find and delete by email if no auth_user_id stored
      const { data: authUsers } = await serviceClient.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email === client.email);
      if (authUser) {
        try {
          await serviceClient.auth.admin.deleteUser(authUser.id);
        } catch (authErr) {
          console.error("Error deleting auth user by email:", authErr);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
