import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * DELETE /api/client/team/[memberId]
 * Remove a team member
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

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

    // Verify the member belongs to this client and is not the owner
    const { data: member } = await serviceClient
      .from("client_users")
      .select("id, role")
      .eq("id", memberId)
      .eq("client_id", client.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the account owner" },
        { status: 400 }
      );
    }

    // Delete the team member
    const { error } = await serviceClient
      .from("client_users")
      .delete()
      .eq("id", memberId);

    if (error) {
      console.error("Error removing member:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/client/team/[memberId]
 * Update a team member's role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !["manager", "member", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
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

    // Verify the member belongs to this client and is not the owner
    const { data: member } = await serviceClient
      .from("client_users")
      .select("id, role")
      .eq("id", memberId)
      .eq("client_id", client.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.role === "owner") {
      return NextResponse.json(
        { error: "Cannot change the owner's role" },
        { status: 400 }
      );
    }

    // Update the role
    const { data: updatedMember, error } = await serviceClient
      .from("client_users")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .select()
      .single();

    if (error) {
      console.error("Error updating member:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    console.error("Error updating team member:", error);
    return NextResponse.json(
      { error: "Failed to update team member" },
      { status: 500 }
    );
  }
}
