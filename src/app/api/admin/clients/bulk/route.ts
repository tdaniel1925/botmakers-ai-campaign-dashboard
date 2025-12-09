import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

export async function DELETE(request: Request) {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Client IDs are required" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Get clients to delete (use service client to bypass RLS)
    const { data: clients, error: fetchError } = await serviceClient
      .from("clients")
      .select("id, email")
      .in("id", ids);

    if (fetchError) {
      console.error("Bulk delete - Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch clients" },
        { status: 500 }
      );
    }

    const deletedCount = { success: 0, failed: 0 };

    // Process each client deletion
    for (const client of clients || []) {
      try {
        // Delete related data in order (respecting foreign key constraints)
        // 1. Delete calls associated with this client's campaigns
        const { data: campaigns } = await serviceClient
          .from("campaigns")
          .select("id")
          .eq("client_id", client.id);

        if (campaigns && campaigns.length > 0) {
          const campaignIds = campaigns.map(c => c.id);
          await serviceClient.from("calls").delete().in("campaign_id", campaignIds);
        }

        // 2. Delete client_users
        await serviceClient.from("client_users").delete().eq("client_id", client.id);

        // 3. Delete inbound campaigns
        await serviceClient.from("inbound_campaigns").delete().eq("client_id", client.id);

        // 4. Delete outbound campaigns
        await serviceClient.from("campaigns").delete().eq("client_id", client.id);

        // 5. Delete email logs
        await serviceClient.from("email_logs").delete().eq("client_id", client.id);

        // 6. Delete notifications
        await serviceClient.from("notifications").delete().eq("client_id", client.id);

        // 7. Delete the client record
        const { error } = await serviceClient.from("clients").delete().eq("id", client.id);

        if (error) {
          console.error(`Error deleting client ${client.id}:`, error);
          deletedCount.failed++;
          continue;
        }

        // 8. Delete auth user if exists (find by email)
        if (client.email) {
          try {
            const { data: authUsers } = await serviceClient.auth.admin.listUsers();
            const authUser = authUsers?.users?.find(u => u.email === client.email);
            if (authUser) {
              await serviceClient.auth.admin.deleteUser(authUser.id);
            }
          } catch (authErr) {
            console.error("Error deleting auth user:", authErr);
          }
        }

        deletedCount.success++;
      } catch (err) {
        console.error(`Error processing client ${client.id}:`, err);
        deletedCount.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount.success,
      failed: deletedCount.failed,
    });
  } catch (error) {
    console.error("Error in bulk delete:", error);
    return NextResponse.json(
      { error: "Failed to delete clients" },
      { status: 500 }
    );
  }
}

// Bulk update (activate/deactivate)
export async function PATCH(request: Request) {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const { ids, action } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Client IDs are required" },
        { status: 400 }
      );
    }

    if (!action || !["activate", "deactivate"].includes(action)) {
      return NextResponse.json(
        { error: "Valid action (activate/deactivate) is required" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    const { error } = await serviceClient
      .from("clients")
      .update({
        is_active: action === "activate",
        updated_at: new Date().toISOString()
      })
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: ids.length,
      action,
    });
  } catch (error) {
    console.error("Error in bulk update:", error);
    return NextResponse.json(
      { error: "Failed to update clients" },
      { status: 500 }
    );
  }
}
