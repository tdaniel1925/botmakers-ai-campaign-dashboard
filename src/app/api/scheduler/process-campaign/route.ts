import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyQStashAndGetBody } from "@/lib/scheduler/verify-qstash";
import {
  scheduleCallBatch,
  scheduleCampaignProcessor,
  isWithinCallingWindow,
  CampaignScheduleConfig,
} from "@/lib/scheduler/qstash";

interface ProcessCampaignBody {
  campaignId: string;
}

/**
 * POST /api/scheduler/process-campaign
 * Process a campaign and queue up calls for eligible contacts
 * Called by QStash scheduler
 */
export async function POST(request: NextRequest) {
  try {
    // Verify QStash signature and get body
    const result = await verifyQStashAndGetBody<ProcessCampaignBody>(request);
    if ("error" in result) {
      return result.error;
    }
    const { campaignId } = result.body;

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select(`
        id,
        status,
        max_concurrent_calls,
        is_test_mode,
        test_call_limit,
        vapi_assistant_id,
        campaign_schedules (
          days_of_week,
          start_time,
          end_time,
          timezone,
          is_active
        ),
        campaign_phone_numbers (
          id,
          phone_number,
          vapi_phone_id,
          is_active
        )
      `)
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.log(`Campaign ${campaignId} not found, stopping processor`);
      return NextResponse.json({ status: "campaign_not_found" });
    }

    // Check if campaign is still active
    if (campaign.status !== "active") {
      console.log(`Campaign ${campaignId} is ${campaign.status}, stopping processor`);
      return NextResponse.json({ status: "campaign_not_active" });
    }

    // Get active schedule
    const activeSchedule = campaign.campaign_schedules?.find(
      (s: { is_active: boolean }) => s.is_active
    );
    if (!activeSchedule) {
      console.log(`Campaign ${campaignId} has no active schedule`);
      // Reschedule processor for later
      await scheduleCampaignProcessor(
        campaignId,
        getBaseUrl(request),
        15 // Check again in 15 minutes
      );
      return NextResponse.json({ status: "no_active_schedule" });
    }

    // Get active phone number
    const activePhone = campaign.campaign_phone_numbers?.find(
      (p: { is_active: boolean }) => p.is_active
    );
    if (!activePhone || !activePhone.vapi_phone_id) {
      console.log(`Campaign ${campaignId} has no active phone number`);
      return NextResponse.json({ status: "no_active_phone" });
    }

    // Count current active calls
    const { count: activeCalls } = await supabase
      .from("campaign_calls")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["initiated", "ringing", "answered"]);

    const availableSlots = campaign.max_concurrent_calls - (activeCalls || 0);

    if (availableSlots <= 0) {
      // All slots occupied, reschedule
      await scheduleCampaignProcessor(
        campaignId,
        getBaseUrl(request),
        1 // Check again in 1 minute
      );
      return NextResponse.json({ status: "slots_full", activeCalls });
    }

    // Check test mode limit
    let testLimit: number | null = null;
    if (campaign.is_test_mode) {
      const { count: testCalls } = await supabase
        .from("campaign_calls")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId);

      if ((testCalls || 0) >= campaign.test_call_limit) {
        // Test limit reached, pause campaign
        await supabase
          .from("outbound_campaigns")
          .update({ status: "paused" })
          .eq("id", campaignId);

        return NextResponse.json({ status: "test_limit_reached" });
      }

      testLimit = campaign.test_call_limit - (testCalls || 0);
    }

    // Get pending contacts that can be called now
    const contactsToFetch = Math.min(
      availableSlots,
      testLimit ?? availableSlots
    );

    const { data: contacts } = await supabase
      .from("campaign_contacts")
      .select("id, phone_number, timezone, first_name, last_name")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .limit(contactsToFetch * 3); // Fetch more to account for timezone filtering

    if (!contacts || contacts.length === 0) {
      // No more contacts, check if campaign is complete
      const { count: pendingCount } = await supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "pending");

      if (pendingCount === 0) {
        await supabase
          .from("outbound_campaigns")
          .update({ status: "completed" })
          .eq("id", campaignId);

        return NextResponse.json({ status: "campaign_completed" });
      }

      // Contacts exist but none eligible now, reschedule
      await scheduleCampaignProcessor(
        campaignId,
        getBaseUrl(request),
        5
      );
      return NextResponse.json({ status: "no_eligible_contacts" });
    }

    // Filter contacts by timezone and schedule
    const scheduleConfig: CampaignScheduleConfig = {
      campaignId,
      daysOfWeek: activeSchedule.days_of_week,
      startTime: activeSchedule.start_time,
      endTime: activeSchedule.end_time,
      timezone: activeSchedule.timezone,
      maxConcurrentCalls: campaign.max_concurrent_calls,
    };

    const eligibleContacts = contacts.filter((contact) => {
      const timezone = contact.timezone || activeSchedule.timezone;
      return isWithinCallingWindow(scheduleConfig, timezone);
    });

    // Schedule calls for eligible contacts
    const callsToSchedule = eligibleContacts.slice(0, contactsToFetch).map((contact) => ({
      campaignId,
      contactId: contact.id,
      phoneNumber: contact.phone_number,
      scheduledFor: new Date(),
      attemptNumber: 1,
    }));

    if (callsToSchedule.length > 0) {
      const result = await scheduleCallBatch(callsToSchedule, getBaseUrl(request));
      console.log(`Scheduled ${result.scheduled} calls for campaign ${campaignId}`);
    }

    // Reschedule processor
    await scheduleCampaignProcessor(
      campaignId,
      getBaseUrl(request),
      1 // Check again in 1 minute for continuous processing
    );

    return NextResponse.json({
      status: "processed",
      scheduled: callsToSchedule.length,
      availableSlots,
    });
  } catch (error) {
    console.error("Error processing campaign:", error);
    return NextResponse.json(
      { error: "Failed to process campaign" },
      { status: 500 }
    );
  }
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
