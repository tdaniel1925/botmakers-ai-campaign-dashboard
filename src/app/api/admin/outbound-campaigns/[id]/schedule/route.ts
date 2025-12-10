import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/outbound-campaigns/[id]/schedule
 * Get schedules for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createClient();

    // Verify campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, name, status")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Get schedules for this campaign
    const { data: schedules, error } = await supabase
      .from("campaign_schedules")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      schedules: schedules || [],
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
    });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/outbound-campaigns/[id]/schedule
 * Add a new schedule to a campaign
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const {
      days_of_week,
      start_time,
      end_time,
      timezone = "America/New_York",
      is_active = true,
    } = body;

    // Validate required fields
    if (!days_of_week || !Array.isArray(days_of_week) || days_of_week.length === 0) {
      return NextResponse.json(
        { error: "At least one day must be selected" },
        { status: 400 }
      );
    }

    if (!start_time || !end_time) {
      return NextResponse.json(
        { error: "Start and end times are required" },
        { status: 400 }
      );
    }

    // Validate days are valid (0-6)
    const validDays = days_of_week.every(
      (d: number) => Number.isInteger(d) && d >= 0 && d <= 6
    );
    if (!validDays) {
      return NextResponse.json(
        { error: "Invalid days of week" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify campaign exists and is in draft status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Schedules can only be modified for draft campaigns" },
        { status: 400 }
      );
    }

    // Create schedule
    const { data: schedule, error } = await supabase
      .from("campaign_schedules")
      .insert({
        campaign_id: id,
        days_of_week,
        start_time,
        end_time,
        timezone,
        is_active,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Error creating schedule:", error);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/outbound-campaigns/[id]/schedule
 * Update an existing schedule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const {
      schedule_id,
      days_of_week,
      start_time,
      end_time,
      timezone,
      is_active,
    } = body;

    if (!schedule_id) {
      return NextResponse.json(
        { error: "Schedule ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify campaign exists and is in draft status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Schedules can only be modified for draft campaigns" },
        { status: 400 }
      );
    }

    // Verify schedule belongs to this campaign
    const { data: existingSchedule, error: scheduleError } = await supabase
      .from("campaign_schedules")
      .select("id")
      .eq("id", schedule_id)
      .eq("campaign_id", id)
      .single();

    if (scheduleError || !existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (days_of_week !== undefined) {
      if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
        return NextResponse.json(
          { error: "At least one day must be selected" },
          { status: 400 }
        );
      }
      updateData.days_of_week = days_of_week;
    }
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    const { data: schedule, error } = await supabase
      .from("campaign_schedules")
      .update(updateData)
      .eq("id", schedule_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error("Error updating schedule:", error);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/outbound-campaigns/[id]/schedule
 * Delete a schedule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("schedule_id");

    if (!scheduleId) {
      return NextResponse.json(
        { error: "Schedule ID is required" },
        { status: 400 }
      );
    }

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createClient();

    // Verify campaign exists and is in draft status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Schedules can only be modified for draft campaigns" },
        { status: 400 }
      );
    }

    // Verify schedule belongs to this campaign
    const { data: existingSchedule, error: scheduleError } = await supabase
      .from("campaign_schedules")
      .select("id")
      .eq("id", scheduleId)
      .eq("campaign_id", id)
      .single();

    if (scheduleError || !existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Delete the schedule
    const { error } = await supabase
      .from("campaign_schedules")
      .delete()
      .eq("id", scheduleId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 }
    );
  }
}
