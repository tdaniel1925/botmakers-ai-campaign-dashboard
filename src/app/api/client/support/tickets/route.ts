import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/client/support/tickets
 * Get all support tickets for the client
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

    // Get client info
    const { data: client } = await serviceClient
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get tickets
    const { data: tickets, error } = await serviceClient
      .from("support_tickets")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tickets:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tickets: tickets || [] });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/client/support/tickets
 * Create a new support ticket
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subject, description, category, priority } = body;

    if (!subject || !description) {
      return NextResponse.json(
        { error: "Subject and description are required" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Get client info
    const { data: client } = await serviceClient
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get client user ID if exists
    const { data: clientUser } = await serviceClient
      .from("client_users")
      .select("id")
      .eq("email", user.email)
      .single();

    // Create ticket
    const { data: ticket, error } = await serviceClient
      .from("support_tickets")
      .insert({
        client_id: client.id,
        created_by_user_id: clientUser?.id || null,
        subject,
        description,
        category: category || "general",
        priority: priority || "normal",
        status: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating ticket:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create initial message
    await serviceClient.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      sender_type: "client",
      sender_id: clientUser?.id || client.id,
      sender_name: user.email,
      message: description,
    });

    // Create notification for admins
    const { data: admins } = await serviceClient
      .from("admin_users")
      .select("id")
      .eq("is_active", true);

    if (admins && admins.length > 0) {
      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        user_type: "admin",
        type: "info",
        title: "New Support Ticket",
        message: `New ticket: ${subject}`,
        link: `/admin/support/${ticket.id}`,
      }));

      await serviceClient.from("notifications").insert(notifications);
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}
