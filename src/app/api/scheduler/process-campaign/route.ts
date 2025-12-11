import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyQStashAndGetBody } from "@/lib/scheduler/verify-qstash";
import {
  scheduleCallBatch,
  scheduleCampaignProcessor,
  isWithinCallingWindow,
  CampaignScheduleConfig,
} from "@/lib/scheduler/qstash";
import { outboundCallRateLimiter, campaignProcessingLock } from "@/lib/rate-limiter";

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

    // Acquire distributed lock to prevent race conditions
    // when multiple processors try to schedule calls simultaneously
    const lockAcquired = await campaignProcessingLock.tryAcquire(campaignId);
    if (!lockAcquired) {
      console.log(`Campaign ${campaignId} is being processed by another instance, skipping`);
      return NextResponse.json({ status: "processing_in_progress" });
    }

    try {
      const supabase = await createClient();

      // Get campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from("outbound_campaigns")
        .select(`
          id,
          status,
          max_concurrent_calls,
          calls_per_minute,
          is_test_mode,
          test_call_limit,
          vapi_assistant_id,
          vapi_phone_number_id,
          vapi_key_source,
          call_provider,
          campaign_schedules (
            days_of_week,
            start_time,
            end_time,
            timezone,
            is_active
          ),
          campaign_phone_numbers!campaign_phone_numbers_campaign_id_fkey (
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

      // Get active phone number - check both local phone numbers and Vapi system keys
      const usingVapiSystemKeys = campaign.call_provider === "vapi" && campaign.vapi_key_source === "system";
      const activePhone = campaign.campaign_phone_numbers?.find(
        (p: { is_active: boolean }) => p.is_active
      );
      const hasVapiPhoneNumber = usingVapiSystemKeys && !!campaign.vapi_phone_number_id;

      if (!hasVapiPhoneNumber && (!activePhone || !activePhone.vapi_phone_id)) {
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

      // Check calls-per-minute rate limit
      const callsPerMinute = campaign.calls_per_minute || 30; // Default to 30 if not set
      const rateLimitStatus = await outboundCallRateLimiter.canMakeCall(
        campaignId,
        callsPerMinute
      );

      if (!rateLimitStatus.allowed) {
        // Rate limit reached, wait until reset
        const waitSeconds = Math.ceil(rateLimitStatus.resetInMs / 1000);
        console.log(
          `Campaign ${campaignId} rate limited (${rateLimitStatus.currentCount}/${callsPerMinute} calls/min). ` +
          `Resets in ${waitSeconds}s`
        );
        await scheduleCampaignProcessor(
          campaignId,
          getBaseUrl(request),
          1 // Check again in 1 minute
        );
        return NextResponse.json({
          status: "rate_limited",
          currentCount: rateLimitStatus.currentCount,
          maxCalls: callsPerMinute,
          resetInMs: rateLimitStatus.resetInMs,
        });
      }

      // Calculate how many calls we can make within the rate limit
      const callsAvailableInWindow = rateLimitStatus.remaining;

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
      // Consider: available concurrent slots, rate limit window, and test mode limit
      const contactsToFetch = Math.min(
        availableSlots,
        callsAvailableInWindow,
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

        // Record each scheduled call in the rate limiter
        for (let i = 0; i < result.scheduled; i++) {
          await outboundCallRateLimiter.recordCall(campaignId, callsPerMinute);
        }
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
    } finally {
      // Always release the lock when done
      await campaignProcessingLock.release(campaignId);
    }
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
