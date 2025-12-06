import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyQStashAndGetBody } from "@/lib/scheduler/verify-qstash";
import { initiateOutboundCall } from "@/lib/vapi/outbound-call";
import { scheduleRetryCall, scheduleSmsFollowup } from "@/lib/scheduler/qstash";

interface ProcessCallBody {
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  attemptNumber?: number;
}

/**
 * POST /api/scheduler/process-call
 * Process a single call - initiate via Vapi
 * Called by QStash scheduler
 */
export async function POST(request: NextRequest) {
  try {
    // Verify QStash signature and get body
    const result = await verifyQStashAndGetBody<ProcessCallBody>(request);
    if ("error" in result) {
      return result.error;
    }
    const { campaignId, contactId, phoneNumber, attemptNumber = 1 } = result.body;

    if (!campaignId || !contactId || !phoneNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
        vapi_assistant_id,
        agent_config,
        retry_enabled,
        retry_attempts,
        retry_delay_minutes,
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
      console.log(`Campaign ${campaignId} not found`);
      return NextResponse.json({ status: "campaign_not_found" });
    }

    // Check if campaign is still active
    if (campaign.status !== "active") {
      console.log(`Campaign ${campaignId} is ${campaign.status}, skipping call`);
      return NextResponse.json({ status: "campaign_not_active" });
    }

    // Get active phone number
    const activePhone = campaign.campaign_phone_numbers?.find(
      (p: { is_active: boolean }) => p.is_active
    );
    if (!activePhone || !activePhone.vapi_phone_id) {
      console.log(`Campaign ${campaignId} has no active phone number`);
      return NextResponse.json({ status: "no_active_phone" });
    }

    // Get contact details
    const { data: contact, error: contactError } = await supabase
      .from("campaign_contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      console.log(`Contact ${contactId} not found`);
      return NextResponse.json({ status: "contact_not_found" });
    }

    // Check contact status
    if (contact.status !== "pending" && contact.status !== "in_progress") {
      console.log(`Contact ${contactId} status is ${contact.status}, skipping`);
      return NextResponse.json({ status: "contact_not_eligible" });
    }

    // Mark contact as in progress
    await supabase
      .from("campaign_contacts")
      .update({
        status: "in_progress",
        call_attempts: (contact.call_attempts || 0) + 1,
        last_called_at: new Date().toISOString(),
      })
      .eq("id", contactId);

    // Prepare dynamic variables for the assistant
    const agentConfig = campaign.agent_config as Record<string, unknown> || {};
    const firstMessage = (agentConfig.first_message as string || "")
      .replace(/\{\{contact_name\}\}/g, `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "there")
      .replace(/\{\{first_name\}\}/g, contact.first_name || "there");

    // Create call record
    const { data: callRecord, error: callError } = await supabase
      .from("campaign_calls")
      .insert({
        campaign_id: campaignId,
        contact_id: contactId,
        phone_number: phoneNumber,
        phone_number_id: activePhone.id,
        status: "initiated",
        call_attempts: attemptNumber,
      })
      .select()
      .single();

    if (callError) {
      console.error("Failed to create call record:", callError);
      // Revert contact status
      await supabase
        .from("campaign_contacts")
        .update({ status: "pending" })
        .eq("id", contactId);
      throw callError;
    }

    try {
      // Initiate the call via Vapi
      const vapiCall = await initiateOutboundCall({
        assistantId: campaign.vapi_assistant_id,
        phoneNumberId: activePhone.vapi_phone_id,
        customerNumber: phoneNumber,
        metadata: {
          campaignId,
          contactId,
          callRecordId: callRecord.id,
          attemptNumber,
        },
        assistantOverrides: firstMessage
          ? { firstMessage }
          : undefined,
      });

      // Update call record with Vapi call ID
      await supabase
        .from("campaign_calls")
        .update({
          vapi_call_id: vapiCall.id,
          status: "ringing",
        })
        .eq("id", callRecord.id);

      return NextResponse.json({
        status: "call_initiated",
        callId: callRecord.id,
        vapiCallId: vapiCall.id,
      });
    } catch (callError) {
      console.error("Failed to initiate Vapi call:", callError);

      // Update call record as failed
      await supabase
        .from("campaign_calls")
        .update({
          status: "failed",
          ended_at: new Date().toISOString(),
        })
        .eq("id", callRecord.id);

      // Check if we should retry
      if (
        campaign.retry_enabled &&
        attemptNumber < campaign.retry_attempts
      ) {
        const baseUrl = getBaseUrl(request);
        await scheduleRetryCall(
          campaignId,
          contactId,
          phoneNumber,
          attemptNumber + 1,
          campaign.retry_delay_minutes,
          baseUrl
        );

        // Keep contact in progress for retry
        await supabase
          .from("campaign_contacts")
          .update({ status: "pending" })
          .eq("id", contactId);

        return NextResponse.json({
          status: "call_failed_retry_scheduled",
          retryIn: campaign.retry_delay_minutes,
        });
      }

      // No more retries, mark contact as failed
      await supabase
        .from("campaign_contacts")
        .update({
          status: "failed",
          outcome: "no_answer",
        })
        .eq("id", contactId);

      // Check for SMS template on failure
      await triggerSmsOnOutcome(
        supabase,
        campaignId,
        contactId,
        phoneNumber,
        "no_answer",
        getBaseUrl(request)
      );

      return NextResponse.json({ status: "call_failed" });
    }
  } catch (error) {
    console.error("Error processing call:", error);
    return NextResponse.json(
      { error: "Failed to process call" },
      { status: 500 }
    );
  }
}

async function triggerSmsOnOutcome(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
  contactId: string,
  phoneNumber: string,
  outcome: string,
  baseUrl: string
) {
  // Find matching SMS template
  const triggerType = outcome === "positive"
    ? "positive_outcome"
    : outcome === "negative"
    ? "negative_outcome"
    : "no_answer";

  const { data: template } = await supabase
    .from("campaign_sms_templates")
    .select("id, delay_minutes")
    .eq("campaign_id", campaignId)
    .eq("trigger_type", triggerType)
    .eq("is_active", true)
    .single();

  if (template) {
    await scheduleSmsFollowup(
      campaignId,
      contactId,
      template.id,
      phoneNumber,
      template.delay_minutes || 0,
      baseUrl
    );
  }
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
