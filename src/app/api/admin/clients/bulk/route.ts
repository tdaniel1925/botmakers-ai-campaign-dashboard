import { createClient, createServiceClient } from "@/lib/supabase/server";
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

    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    // Get clients to find auth_user_ids
    const { data: clients } = await supabase
      .from("clients")
      .select("id, auth_user_id, email")
      .in("id", ids);

    const deletedCount = { success: 0, failed: 0 };

    // Process each client deletion
    for (const client of clients || []) {
      try {
        // Delete related data in order (respecting foreign key constraints)
        // 1. Delete calls associated with this client's campaigns
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id")
          .eq("client_id", client.id);

        if (campaigns && campaigns.length > 0) {
          const campaignIds = campaigns.map(c => c.id);
          await supabase.from("calls").delete().in("campaign_id", campaignIds);
        }

        // 2. Delete inbound campaigns
        await supabase.from("inbound_campaigns").delete().eq("client_id", client.id);

        // 3. Delete outbound campaigns
        await supabase.from("campaigns").delete().eq("client_id", client.id);

        // 4. Delete email logs
        await supabase.from("email_logs").delete().eq("client_id", client.id);

        // 5. Delete notifications
        await supabase.from("notifications").delete().eq("client_id", client.id);

        // 6. Delete the client record
        const { error } = await supabase.from("clients").delete().eq("id", client.id);

        if (error) {
          console.error(`Error deleting client ${client.id}:`, error);
          deletedCount.failed++;
          continue;
        }

        // 7. Delete auth user if exists
        if (client.auth_user_id) {
          try {
            await serviceClient.auth.admin.deleteUser(client.auth_user_id);
          } catch (authErr) {
            console.error("Error deleting auth user:", authErr);
          }
        } else if (client.email) {
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

    const supabase = await createClient();

    const { error } = await supabase
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
