import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scheduleSmsFollowup, scheduleRetryCall } from "@/lib/scheduler/qstash";
import { webhookDeduplicator } from "@/lib/rate-limiter";

/**
 * POST /api/webhooks/vapi-outbound
 * Handle Vapi webhook events for outbound calls
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: "No message in payload" }, { status: 400 });
    }

    const supabase = await createClient();
    const baseUrl = getBaseUrl(request);

    // Extract metadata from call
    const metadata = message.call?.metadata || {};
    const { campaignId, contactId, callRecordId, attemptNumber } = metadata;

    if (!callRecordId) {
      console.log("No call record ID in metadata, skipping");
      return NextResponse.json({ status: "no_call_record" });
    }

    // Deduplicate webhooks - use callRecordId + message type as key
    const vapiCallId = message.call?.id || callRecordId;
    const dedupeKey = `${vapiCallId}:${message.type}`;
    const isDuplicate = await webhookDeduplicator.isDuplicate(campaignId || "vapi", dedupeKey);

    if (isDuplicate) {
      console.log(`Duplicate webhook detected for ${dedupeKey}, skipping`);
      return NextResponse.json({ status: "duplicate", key: dedupeKey });
    }

    // Handle different message types
    switch (message.type) {
      case "status-update":
        await handleStatusUpdate(supabase, callRecordId, message);
        break;

      case "end-of-call-report":
        await handleEndOfCall(
          supabase,
          callRecordId,
          campaignId,
          contactId,
          attemptNumber,
          message,
          baseUrl
        );
        break;

      case "transcript":
        await handleTranscript(supabase, callRecordId, message);
        break;

      default:
        console.log(`Unhandled message type: ${message.type}`);
    }

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    console.error("Error processing Vapi webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

async function handleStatusUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  callRecordId: string,
  message: Record<string, unknown>
) {
  const status = message.status as string;

  // Map Vapi status to our status
  const statusMap: Record<string, string> = {
    "in-progress": "answered",
    ringing: "ringing",
    queued: "initiated",
    completed: "completed",
    busy: "busy",
    "no-answer": "no_answer",
    failed: "failed",
    canceled: "failed",
  };

  const mappedStatus = statusMap[status] || status;

  await supabase
    .from("campaign_calls")
    .update({
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", callRecordId);
}

async function handleEndOfCall(
  supabase: Awaited<ReturnType<typeof createClient>>,
  callRecordId: string,
  campaignId: string,
  contactId: string,
  attemptNumber: number,
  message: Record<string, unknown>,
  baseUrl: string
) {
  const call = message.call as Record<string, unknown> || {};
  const analysis = message.analysis as Record<string, unknown> || {};
  const artifact = message.artifact as Record<string, unknown> || {};

  // Extract call data
  const endedReason = call.endedReason as string || "unknown";
  const durationSeconds = typeof call.duration === "number" ? call.duration : null;
  const cost = typeof call.cost === "number" ? call.cost : null;
  const recordingUrl = artifact.recordingUrl as string || null;
  const transcript = artifact.transcript as string || null;
  const structuredData = analysis.structuredData as Record<string, unknown> || null;
  const summary = analysis.summary as string || null;

  // Determine outcome based on structured data or analysis
  let outcome: "positive" | "negative" | "neutral" | null = null;

  if (structuredData) {
    // Check for common outcome indicators
    if (
      structuredData.interested === true ||
      structuredData.outcome === "positive" ||
      structuredData.appointment_scheduled === true
    ) {
      outcome = "positive";
    } else if (
      structuredData.interested === false ||
      structuredData.outcome === "negative" ||
      structuredData.do_not_call === true
    ) {
      outcome = "negative";
    } else {
      outcome = "neutral";
    }
  }

  // Determine final status
  let status: string;
  if (endedReason === "customer-ended" || endedReason === "assistant-ended") {
    status = "completed";
  } else if (endedReason === "customer-did-not-answer" || endedReason === "no-answer") {
    status = "no_answer";
    outcome = null;
  } else if (endedReason === "customer-busy") {
    status = "busy";
    outcome = null;
  } else if (endedReason.includes("error") || endedReason.includes("failed")) {
    status = "failed";
    outcome = null;
  } else {
    status = "completed";
  }

  // Update call record
  await supabase
    .from("campaign_calls")
    .update({
      status,
      outcome,
      duration_seconds: durationSeconds,
      cost: cost?.toFixed(4),
      recording_url: recordingUrl,
      transcript,
      structured_data: structuredData,
      summary,
      ended_at: new Date().toISOString(),
      vapi_ended_reason: endedReason,
    })
    .eq("id", callRecordId);

  // Get campaign for retry settings
  const { data: campaign } = await supabase
    .from("outbound_campaigns")
    .select("retry_enabled, retry_attempts, retry_delay_minutes")
    .eq("id", campaignId)
    .single();

  // Handle retries for unanswered calls
  if (
    (status === "no_answer" || status === "busy") &&
    campaign?.retry_enabled &&
    attemptNumber < campaign.retry_attempts
  ) {
    // Get contact phone
    const { data: contact } = await supabase
      .from("campaign_contacts")
      .select("phone_number")
      .eq("id", contactId)
      .single();

    if (contact) {
      await scheduleRetryCall(
        campaignId,
        contactId,
        contact.phone_number,
        attemptNumber + 1,
        campaign.retry_delay_minutes,
        baseUrl
      );

      // Keep contact status as pending for retry
      await supabase
        .from("campaign_contacts")
        .update({ status: "pending" })
        .eq("id", contactId);

      return;
    }
  }

  // Update contact status
  const contactStatus = status === "completed" ? "completed" : "failed";
  await supabase
    .from("campaign_contacts")
    .update({
      status: contactStatus,
      outcome,
    })
    .eq("id", contactId);

  // Update campaign stats
  await supabase.rpc("update_campaign_stats_on_call", {
    p_campaign_id: campaignId,
    p_outcome: outcome,
    p_duration: durationSeconds,
    p_cost: cost,
  });

  // Trigger SMS follow-up if configured
  if (outcome) {
    await triggerSmsForOutcome(supabase, campaignId, contactId, outcome, baseUrl);
  }
}

async function handleTranscript(
  supabase: Awaited<ReturnType<typeof createClient>>,
  callRecordId: string,
  message: Record<string, unknown>
) {
  const artifact = message.artifact as Record<string, unknown> || {};
  const transcript = artifact.transcript as string;

  if (transcript) {
    await supabase
      .from("campaign_calls")
      .update({ transcript })
      .eq("id", callRecordId);
  }
}

async function triggerSmsForOutcome(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
  contactId: string,
  outcome: "positive" | "negative" | "neutral",
  baseUrl: string
) {
  // Map outcome to trigger type
  const triggerType = outcome === "positive"
    ? "positive_outcome"
    : outcome === "negative"
    ? "negative_outcome"
    : "call_completed";

  // Find matching template
  const { data: template } = await supabase
    .from("campaign_sms_templates")
    .select("id, delay_minutes")
    .eq("campaign_id", campaignId)
    .or(`trigger_type.eq.${triggerType},trigger_type.eq.call_completed`)
    .eq("is_active", true)
    .order("trigger_type", { ascending: false }) // Specific outcomes first
    .limit(1)
    .single();

  if (!template) return;

  // Get contact phone
  const { data: contact } = await supabase
    .from("campaign_contacts")
    .select("phone_number")
    .eq("id", contactId)
    .single();

  if (!contact) return;

  // Schedule SMS
  await scheduleSmsFollowup(
    campaignId,
    contactId,
    template.id,
    contact.phone_number,
    template.delay_minutes || 0,
    baseUrl
  );
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
