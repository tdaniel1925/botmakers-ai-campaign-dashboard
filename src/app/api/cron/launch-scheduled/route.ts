import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scheduleCampaignProcessor } from "@/lib/scheduler/qstash";

/**
 * GET /api/cron/launch-scheduled
 * Cron job to check for scheduled campaigns and launch them
 * Runs every minute via Vercel cron
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request (Vercel sends this header)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the cron secret
    if (process.env.NODE_ENV === "production" && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = await createServiceClient();
    const now = new Date().toISOString();

    // Find campaigns that are scheduled and their launch time has passed
    const { data: scheduledCampaigns, error } = await supabase
      .from("outbound_campaigns")
      .select(`
        id,
        name,
        scheduled_launch_at,
        is_test_mode,
        total_contacts
      `)
      .eq("status", "scheduled")
      .not("scheduled_launch_at", "is", null)
      .lte("scheduled_launch_at", now);

    if (error) {
      console.error("[Cron] Error fetching scheduled campaigns:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      return NextResponse.json({
        status: "no_campaigns_to_launch",
        checked_at: now
      });
    }

    const launched: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];
    const baseUrl = getBaseUrl(request);

    for (const campaign of scheduledCampaigns) {
      try {
        // Validate campaign has contacts
        if (campaign.total_contacts === 0) {
          console.log(`[Cron] Skipping campaign ${campaign.id}: no contacts`);
          errors.push({ id: campaign.id, error: "No contacts" });
          continue;
        }

        console.log(`[Cron] Launching scheduled campaign: ${campaign.name} (${campaign.id})`);

        // Update campaign status to active
        const { error: updateError } = await supabase
          .from("outbound_campaigns")
          .update({
            status: "active",
            launched_at: now,
            scheduled_launch_at: null, // Clear the schedule
            updated_at: now,
          })
          .eq("id", campaign.id)
          .eq("status", "scheduled"); // Only update if still scheduled (prevent race conditions)

        if (updateError) {
          console.error(`[Cron] Error launching campaign ${campaign.id}:`, updateError);
          errors.push({ id: campaign.id, error: updateError.message });
          continue;
        }

        // Start the campaign processor
        await scheduleCampaignProcessor(campaign.id, baseUrl, 0); // 0 = start immediately

        launched.push(campaign.id);
        console.log(`[Cron] Successfully launched campaign ${campaign.id}`);
      } catch (err) {
        console.error(`[Cron] Error launching campaign ${campaign.id}:`, err);
        errors.push({
          id: campaign.id,
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }

    return NextResponse.json({
      status: "processed",
      checked_at: now,
      campaigns_found: scheduledCampaigns.length,
      launched,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Cron] Error in launch-scheduled:", error);
    return NextResponse.json(
      { error: "Failed to process scheduled launches" },
      { status: 500 }
    );
  }
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
