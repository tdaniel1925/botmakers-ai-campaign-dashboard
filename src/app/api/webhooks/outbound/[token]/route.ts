import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/webhooks/outbound/[token]
 * Handle webhook events for outbound calls from all providers
 * Token is the campaign's webhook_token for authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();

    const supabase = await createServiceClient();

    // Validate webhook token and get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, call_provider, webhook_token")
      .eq("webhook_token", token)
      .single();

    if (campaignError || !campaign) {
      console.error("Invalid webhook token:", token);
      return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
    }

    // Log raw webhook for debugging
    console.log(`[Outbound Webhook] Campaign: ${campaign.id}, Provider: ${campaign.call_provider}`);
    console.log(`[Outbound Webhook] Raw payload:`, JSON.stringify(body, null, 2));

    // Handle based on provider
    switch (campaign.call_provider) {
      case "vapi":
        return await handleVapiWebhook(supabase, campaign.id, body);
      case "autocalls":
        return await handleAutoCallsWebhook(supabase, campaign.id, body);
      case "synthflow":
        return await handleSynthflowWebhook(supabase, campaign.id, body);
      default:
        console.log(`Unknown provider: ${campaign.call_provider}`);
        return NextResponse.json({ status: "unknown_provider" });
    }
  } catch (error) {
    console.error("Error processing outbound webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * Handle Vapi webhook events
 */
async function handleVapiWebhook(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  campaignId: string,
  body: Record<string, unknown>
) {
  const { message } = body;

  if (!message) {
    return NextResponse.json({ error: "No message in payload" }, { status: 400 });
  }

  // Extract metadata from call
  const metadata = (message as Record<string, unknown>).call
    ? ((message as Record<string, unknown>).call as Record<string, unknown>).metadata as Record<string, unknown> || {}
    : {};
  const { callRecordId, contactId, attemptNumber, isTest } = metadata;

  if (!callRecordId) {
    console.log("No call record ID in metadata, skipping");
    return NextResponse.json({ status: "no_call_record" });
  }

  const messageType = (message as Record<string, unknown>).type as string;

  // Handle different message types
  switch (messageType) {
    case "status-update":
      await handleVapiStatusUpdate(supabase, callRecordId as string, message as Record<string, unknown>);
      break;

    case "end-of-call-report":
      await handleVapiEndOfCall(
        supabase,
        callRecordId as string,
        campaignId,
        contactId as string | undefined,
        attemptNumber as number | undefined,
        message as Record<string, unknown>,
        isTest as boolean | undefined
      );
      break;

    case "transcript":
      await handleVapiTranscript(supabase, callRecordId as string, message as Record<string, unknown>);
      break;

    default:
      console.log(`Unhandled Vapi message type: ${messageType}`);
  }

  return NextResponse.json({ status: "processed" });
}

async function handleVapiStatusUpdate(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  callRecordId: string,
  message: Record<string, unknown>
) {
  const status = message.status as string;

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

async function handleVapiEndOfCall(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  callRecordId: string,
  campaignId: string,
  contactId: string | undefined,
  attemptNumber: number | undefined,
  message: Record<string, unknown>,
  isTest: boolean | undefined
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

  // Determine outcome based on structured data
  let outcome: "positive" | "negative" | "neutral" | null = null;

  if (structuredData) {
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

  // Skip contact/campaign updates for test calls
  if (isTest) {
    return;
  }

  // Update contact status if not a test call
  if (contactId) {
    const contactStatus = status === "completed" ? "completed" : "failed";
    await supabase
      .from("campaign_contacts")
      .update({
        status: contactStatus,
        outcome,
      })
      .eq("id", contactId);
  }

  // Update campaign stats (RPC call)
  try {
    await supabase.rpc("update_campaign_stats_on_call", {
      p_campaign_id: campaignId,
      p_outcome: outcome,
      p_duration: durationSeconds,
      p_cost: cost,
    });
  } catch (rpcError) {
    console.error("Error updating campaign stats:", rpcError);
  }
}

async function handleVapiTranscript(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
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

/**
 * Handle AutoCalls.ai webhook events
 */
async function handleAutoCallsWebhook(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  campaignId: string,
  body: Record<string, unknown>
) {
  // AutoCalls.ai webhook format may vary - adjust based on actual API docs
  const { event, call_id, status, duration, recording_url, transcript, metadata } = body;

  const callMetadata = metadata as Record<string, unknown> || {};
  const callRecordId = callMetadata.callRecordId as string;

  if (!callRecordId) {
    console.log("No call record ID in AutoCalls metadata");
    return NextResponse.json({ status: "no_call_record" });
  }

  if (event === "call.completed" || event === "call.ended") {
    // Update call record
    await supabase
      .from("campaign_calls")
      .update({
        status: mapAutoCallsStatus(status as string),
        duration_seconds: duration as number,
        recording_url: recording_url as string,
        transcript: transcript as string,
        ended_at: new Date().toISOString(),
      })
      .eq("id", callRecordId);
  } else if (event === "call.started" || event === "call.answered") {
    await supabase
      .from("campaign_calls")
      .update({
        status: "answered",
        updated_at: new Date().toISOString(),
      })
      .eq("id", callRecordId);
  }

  return NextResponse.json({ status: "processed" });
}

function mapAutoCallsStatus(status: string): string {
  const statusMap: Record<string, string> = {
    completed: "completed",
    answered: "answered",
    no_answer: "no_answer",
    busy: "busy",
    failed: "failed",
    voicemail: "voicemail",
  };
  return statusMap[status] || status;
}

/**
 * Handle Synthflow webhook events
 */
async function handleSynthflowWebhook(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  campaignId: string,
  body: Record<string, unknown>
) {
  // Synthflow webhook format may vary - adjust based on actual API docs
  const { event_type, call_id, status, duration_seconds, recording_url, transcript, metadata, structured_data } = body;

  const callMetadata = metadata as Record<string, unknown> || {};
  const callRecordId = callMetadata.callRecordId as string;

  if (!callRecordId) {
    console.log("No call record ID in Synthflow metadata");
    return NextResponse.json({ status: "no_call_record" });
  }

  if (event_type === "call.completed" || event_type === "call_ended") {
    // Determine outcome from structured data
    let outcome: "positive" | "negative" | "neutral" | null = null;
    const structData = structured_data as Record<string, unknown>;
    if (structData) {
      if (structData.interested === true || structData.outcome === "positive") {
        outcome = "positive";
      } else if (structData.interested === false || structData.outcome === "negative") {
        outcome = "negative";
      } else {
        outcome = "neutral";
      }
    }

    await supabase
      .from("campaign_calls")
      .update({
        status: mapSynthflowStatus(status as string),
        outcome,
        duration_seconds: duration_seconds as number,
        recording_url: recording_url as string,
        transcript: transcript as string,
        structured_data: structData,
        ended_at: new Date().toISOString(),
      })
      .eq("id", callRecordId);
  } else if (event_type === "call.started" || event_type === "call_answered") {
    await supabase
      .from("campaign_calls")
      .update({
        status: "answered",
        updated_at: new Date().toISOString(),
      })
      .eq("id", callRecordId);
  }

  return NextResponse.json({ status: "processed" });
}

function mapSynthflowStatus(status: string): string {
  const statusMap: Record<string, string> = {
    completed: "completed",
    answered: "answered",
    no_answer: "no_answer",
    busy: "busy",
    failed: "failed",
  };
  return statusMap[status] || status;
}
