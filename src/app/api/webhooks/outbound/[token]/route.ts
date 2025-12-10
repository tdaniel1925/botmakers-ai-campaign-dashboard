import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processOutboundCallForSms } from "@/lib/sms/campaign-trigger";

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
    console.log(`[Outbound Webhook] ========================================`);
    console.log(`[Outbound Webhook] Campaign: ${campaign.id}, Provider: ${campaign.call_provider}`);
    console.log(`[Outbound Webhook] Raw payload:`, JSON.stringify(body, null, 2));
    console.log(`[Outbound Webhook] ========================================`);

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

  console.log(`[Vapi Webhook] Message received:`, message ? "yes" : "no");

  if (!message) {
    console.log(`[Vapi Webhook] No message in payload, keys: ${Object.keys(body).join(", ")}`);
    return NextResponse.json({ error: "No message in payload" }, { status: 400 });
  }

  const messageType = (message as Record<string, unknown>).type as string;
  console.log(`[Vapi Webhook] Message type: ${messageType}`);

  // Extract metadata from call
  const call = (message as Record<string, unknown>).call as Record<string, unknown> | undefined;
  const metadata = call?.metadata as Record<string, unknown> || {};
  const { callRecordId, contactId, attemptNumber, isTest } = metadata;

  console.log(`[Vapi Webhook] Call record ID: ${callRecordId}, Is test: ${isTest}`);
  console.log(`[Vapi Webhook] Metadata:`, JSON.stringify(metadata));

  if (!callRecordId) {
    console.log("[Vapi Webhook] No call record ID in metadata, skipping");
    return NextResponse.json({ status: "no_call_record" });
  }

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
  console.log(`[Vapi End of Call] Processing for call record: ${callRecordId}`);
  console.log(`[Vapi End of Call] Full message:`, JSON.stringify(message, null, 2));

  // Vapi can send data at different levels depending on version
  // Try multiple paths to find the data
  const call = message.call as Record<string, unknown> || {};
  const analysis = message.analysis as Record<string, unknown> || {};
  const artifact = message.artifact as Record<string, unknown> || {};

  // Also check top-level message for data (some Vapi versions put it there)
  const topLevelAnalysis = message as Record<string, unknown>;

  console.log(`[Vapi End of Call] Message keys: ${Object.keys(message).join(", ")}`);
  console.log(`[Vapi End of Call] Call object keys: ${Object.keys(call).join(", ")}`);
  console.log(`[Vapi End of Call] Analysis object keys: ${Object.keys(analysis).join(", ")}`);
  console.log(`[Vapi End of Call] Artifact object keys: ${Object.keys(artifact).join(", ")}`);

  // Extract call data - try multiple paths
  const endedReason = (call.endedReason as string) || (message.endedReason as string) || "unknown";

  // Duration can be in different places - Vapi sends it in multiple formats
  let durationSeconds: number | null = null;
  if (typeof call.duration === "number") durationSeconds = call.duration;
  else if (typeof message.duration === "number") durationSeconds = message.duration;
  else if (typeof call.durationSeconds === "number") durationSeconds = call.durationSeconds;
  else if (typeof message.durationSeconds === "number") durationSeconds = message.durationSeconds;
  // Check startedAt/endedAt timestamps to calculate duration
  else if (call.startedAt && call.endedAt) {
    const startTime = new Date(call.startedAt as string).getTime();
    const endTime = new Date(call.endedAt as string).getTime();
    if (!isNaN(startTime) && !isNaN(endTime)) {
      durationSeconds = Math.round((endTime - startTime) / 1000);
    }
  }
  // Also check artifact for stereoRecordingUrl duration
  else if (artifact.stereoRecordingUrl || artifact.recordingUrl) {
    // If we have a recording, try to get duration from the call timestamps
    if (message.startedAt && message.endedAt) {
      const startTime = new Date(message.startedAt as string).getTime();
      const endTime = new Date(message.endedAt as string).getTime();
      if (!isNaN(startTime) && !isNaN(endTime)) {
        durationSeconds = Math.round((endTime - startTime) / 1000);
      }
    }
  }

  // Cost - check multiple paths including costBreakdown
  let cost: number | null = null;
  if (typeof call.cost === "number") cost = call.cost;
  else if (typeof message.cost === "number") cost = message.cost;
  else if (call.costBreakdown && typeof (call.costBreakdown as Record<string, unknown>).total === "number") {
    cost = (call.costBreakdown as Record<string, unknown>).total as number;
  }
  else if (message.costBreakdown && typeof (message.costBreakdown as Record<string, unknown>).total === "number") {
    cost = (message.costBreakdown as Record<string, unknown>).total as number;
  }
  // Parse string cost if present
  else if (typeof call.cost === "string") cost = parseFloat(call.cost as string) || null;
  else if (typeof message.cost === "string") cost = parseFloat(message.cost as string) || null;

  // Recording URL - check multiple paths
  const recordingUrl = (artifact.recordingUrl as string)
    || (artifact.stereoRecordingUrl as string)
    || (artifact.recording as string)
    || (message.recordingUrl as string)
    || (message.stereoRecordingUrl as string)
    || (call.recordingUrl as string)
    || (call.stereoRecordingUrl as string)
    || null;

  // Log all potential data sources for debugging
  console.log(`[Vapi End of Call] Duration sources:`, {
    "call.duration": call.duration,
    "message.duration": message.duration,
    "call.durationSeconds": call.durationSeconds,
    "message.durationSeconds": message.durationSeconds,
    "call.startedAt": call.startedAt,
    "call.endedAt": call.endedAt,
  });
  console.log(`[Vapi End of Call] Cost sources:`, {
    "call.cost": call.cost,
    "message.cost": message.cost,
    "call.costBreakdown": call.costBreakdown,
    "message.costBreakdown": message.costBreakdown,
  });

  // Transcript - check multiple paths including messages array
  let transcript: string | null = null;
  if (artifact.transcript) {
    transcript = artifact.transcript as string;
  } else if (message.transcript) {
    transcript = message.transcript as string;
  } else if (artifact.messages && Array.isArray(artifact.messages)) {
    // Build transcript from messages array
    const messages = artifact.messages as Array<{ role: string; message?: string; content?: string }>;
    transcript = messages
      .map(m => `${m.role}: ${m.message || m.content || ""}`)
      .join("\n");
  } else if (message.messages && Array.isArray(message.messages)) {
    const messages = message.messages as Array<{ role: string; message?: string; content?: string }>;
    transcript = messages
      .map(m => `${m.role}: ${m.message || m.content || ""}`)
      .join("\n");
  }

  // Structured data - check multiple paths
  const structuredData = (analysis.structuredData as Record<string, unknown>)
    || (message.structuredData as Record<string, unknown>)
    || (topLevelAnalysis.structuredData as Record<string, unknown>)
    || null;

  // Summary - check multiple paths
  const summary = (analysis.summary as string)
    || (message.summary as string)
    || (topLevelAnalysis.summary as string)
    || null;

  console.log(`[Vapi End of Call] Extracted data:`, {
    endedReason,
    durationSeconds,
    cost,
    recordingUrl: recordingUrl ? "present" : "null",
    transcript: transcript ? `${transcript.length} chars` : "null",
    structuredData: structuredData ? "present" : "null",
    summary: summary ? `${summary.length} chars` : "null",
  });

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

  // Extract timestamps for better tracking
  const answeredAt = (call.startedAt as string) || (message.startedAt as string) || null;
  const endedAt = (call.endedAt as string) || (message.endedAt as string) || new Date().toISOString();

  // Update call record
  const updateData: Record<string, unknown> = {
    status,
    outcome,
    duration_seconds: durationSeconds !== null ? Math.round(durationSeconds) : null,
    cost: cost !== null ? cost.toFixed(4) : null,
    recording_url: recordingUrl,
    transcript,
    structured_data: structuredData,
    summary,
    ended_at: endedAt,
    vapi_ended_reason: endedReason,
  };

  // Only set answered_at if we have it and it's not already set
  if (answeredAt) {
    updateData.answered_at = answeredAt;
  }

  console.log(`[Vapi End of Call] Updating call record with:`, {
    ...updateData,
    transcript: transcript ? `${transcript.length} chars` : null,
  });

  const { error: updateError } = await supabase
    .from("campaign_calls")
    .update(updateData)
    .eq("id", callRecordId);

  if (updateError) {
    console.error(`[Vapi End of Call] Error updating call record:`, updateError);
  } else {
    console.log(`[Vapi End of Call] Successfully updated call record ${callRecordId}`);
  }

  // Process SMS rules (works for both test and production calls)
  // We process SMS even for test calls so we can verify SMS rules work
  if (transcript && status === "completed") {
    try {
      console.log(`[Vapi End of Call] Processing SMS rules for call ${callRecordId}`);
      const smsResult = await processOutboundCallForSms(callRecordId, campaignId);
      console.log(`[Vapi End of Call] SMS processing result:`, smsResult);
    } catch (smsError) {
      console.error(`[Vapi End of Call] Error processing SMS:`, smsError);
      // Don't fail the webhook if SMS processing fails
    }
  }

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
    const mappedStatus = mapAutoCallsStatus(status as string);

    // Update call record
    const durationValue = duration as number | undefined;
    await supabase
      .from("campaign_calls")
      .update({
        status: mappedStatus,
        duration_seconds: durationValue !== undefined ? Math.round(durationValue) : null,
        recording_url: recording_url as string,
        transcript: transcript as string,
        ended_at: new Date().toISOString(),
      })
      .eq("id", callRecordId);

    // Process SMS rules if call completed with transcript
    if (transcript && mappedStatus === "completed") {
      try {
        console.log(`[AutoCalls Webhook] Processing SMS rules for call ${callRecordId}`);
        const smsResult = await processOutboundCallForSms(callRecordId, campaignId);
        console.log(`[AutoCalls Webhook] SMS processing result:`, smsResult);
      } catch (smsError) {
        console.error(`[AutoCalls Webhook] Error processing SMS:`, smsError);
      }
    }
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
    const mappedStatus = mapSynthflowStatus(status as string);

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

    const durationValue = duration_seconds as number | undefined;
    await supabase
      .from("campaign_calls")
      .update({
        status: mappedStatus,
        outcome,
        duration_seconds: durationValue !== undefined ? Math.round(durationValue) : null,
        recording_url: recording_url as string,
        transcript: transcript as string,
        structured_data: structData,
        ended_at: new Date().toISOString(),
      })
      .eq("id", callRecordId);

    // Process SMS rules if call completed with transcript
    if (transcript && mappedStatus === "completed") {
      try {
        console.log(`[Synthflow Webhook] Processing SMS rules for call ${callRecordId}`);
        const smsResult = await processOutboundCallForSms(callRecordId, campaignId);
        console.log(`[Synthflow Webhook] SMS processing result:`, smsResult);
      } catch (smsError) {
        console.error(`[Synthflow Webhook] Error processing SMS:`, smsError);
      }
    }
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
