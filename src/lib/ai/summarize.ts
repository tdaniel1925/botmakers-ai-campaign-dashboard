import { summarizeCall, SummarizationResult } from "./deepseek";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { trackCallUsage } from "@/lib/billing/usage-tracker";
import { processCallForSms } from "@/lib/sms";

// Lazy init to avoid build-time errors when env vars aren't available
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type CallType = "legacy" | "inbound";

// Type for the Supabase client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientType = SupabaseClient<any, any, any>;

export async function processCallWithAI(callId: string, callType: CallType = "legacy"): Promise<void> {
  const supabase = getSupabaseClient();
  try {
    // Different query based on call type
    if (callType === "inbound") {
      await processInboundCallWithAI(supabase, callId);
    } else {
      await processLegacyCallWithAI(supabase, callId);
    }
  } catch (error) {
    console.error("Error processing call with AI:", error);
    await updateCallStatus(
      callId,
      "failed",
      error instanceof Error ? error.message : "Unknown error",
      callType
    );
  }
}

// Process legacy campaign calls (from "calls" table)
async function processLegacyCallWithAI(supabase: SupabaseClientType, callId: string): Promise<void> {
  // Fetch the call record with campaign and client info
  const { data: call, error: callError } = await supabase
    .from("calls")
    .select(
      `
      *,
      campaigns (
        id,
        client_id,
        campaign_outcome_tags (
          id,
          tag_name
        )
      )
    `
    )
    .eq("id", callId)
    .single();

  if (callError || !call) {
    console.error("Failed to fetch call:", callError);
    await updateCallStatus(callId, "failed", "Call not found", "legacy");
    return;
  }

  if (!call.transcript) {
    await updateCallStatus(callId, "failed", "No transcript available", "legacy");
    return;
  }

  // Get outcome tags for this campaign
  const outcomeTags =
    call.campaigns?.campaign_outcome_tags?.map(
      (tag: { tag_name: string }) => tag.tag_name
    ) || [];

  // Call AI summarization
  let result: SummarizationResult;
  try {
    result = await summarizeCall(call.transcript, outcomeTags);
  } catch (aiError) {
    console.error("AI summarization failed:", aiError);
    await updateCallStatus(callId, "failed", "AI summarization failed", "legacy");
    return;
  }

  // Find matching outcome tag ID
  let outcomeTagId: string | null = null;
  if (result.outcome && call.campaigns?.campaign_outcome_tags) {
    const matchingTag = call.campaigns.campaign_outcome_tags.find(
      (tag: { tag_name: string }) =>
        tag.tag_name.toLowerCase() === result.outcome.toLowerCase()
    );
    if (matchingTag) {
      outcomeTagId = matchingTag.id;
    }
  }

  // Update call record with AI results
  const { error: updateError } = await supabase
    .from("calls")
    .update({
      ai_summary: result.summary,
      ai_outcome_tag_id: outcomeTagId,
      ai_sentiment: result.sentiment,
      ai_key_points: result.keyPoints,
      ai_caller_intent: result.callerIntent,
      ai_resolution: result.resolution,
      ai_processed_at: new Date().toISOString(),
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", callId);

  if (updateError) {
    console.error("Failed to update call with AI results:", updateError);
    await updateCallStatus(callId, "failed", "Failed to save AI results", "legacy");
  } else {
    // Track usage for billing after successful processing
    const clientId = call.campaigns?.client_id;
    if (clientId) {
      // Convert call duration from seconds to minutes
      const durationMinutes = call.call_duration
        ? Math.ceil(call.call_duration / 60)
        : 1; // Minimum 1 minute charge

      try {
        await trackCallUsage(clientId, callId, durationMinutes);
      } catch (billingError) {
        // Log but don't fail the call processing
        console.error("Failed to track usage:", billingError);
      }
    }

    // Process SMS rules after successful AI analysis
    try {
      const smsResult = await processCallForSms(callId);
      if (smsResult.sent) {
        console.log(`SMS triggered for call ${callId}, log ID: ${smsResult.smsLogId}`);
      }
    } catch (smsError) {
      // Log but don't fail the call processing
      console.error("SMS processing error:", smsError);
    }
  }
}

// Process inbound campaign calls (from "inbound_campaign_calls" table)
async function processInboundCallWithAI(supabase: SupabaseClientType, callId: string): Promise<void> {
  // Fetch the call record with campaign and client info
  const { data: call, error: callError } = await supabase
    .from("inbound_campaign_calls")
    .select(
      `
      *,
      inbound_campaigns (
        id,
        client_id,
        inbound_campaign_outcome_tags (
          id,
          tag_name
        )
      )
    `
    )
    .eq("id", callId)
    .single();

  if (callError || !call) {
    console.error("Failed to fetch inbound call:", callError);
    await updateCallStatus(callId, "failed", "Call not found", "inbound");
    return;
  }

  if (!call.transcript) {
    await updateCallStatus(callId, "failed", "No transcript available", "inbound");
    return;
  }

  // Get outcome tags for this campaign
  const outcomeTags =
    call.inbound_campaigns?.inbound_campaign_outcome_tags?.map(
      (tag: { tag_name: string }) => tag.tag_name
    ) || [];

  // Call AI summarization
  let result: SummarizationResult;
  try {
    result = await summarizeCall(call.transcript, outcomeTags);
  } catch (aiError) {
    console.error("AI summarization failed:", aiError);
    await updateCallStatus(callId, "failed", "AI summarization failed", "inbound");
    return;
  }

  // Find matching outcome tag ID
  let outcomeTagId: string | null = null;
  if (result.outcome && call.inbound_campaigns?.inbound_campaign_outcome_tags) {
    const matchingTag = call.inbound_campaigns.inbound_campaign_outcome_tags.find(
      (tag: { tag_name: string }) =>
        tag.tag_name.toLowerCase() === result.outcome.toLowerCase()
    );
    if (matchingTag) {
      outcomeTagId = matchingTag.id;
    }
  }

  // Update call record with AI results
  // Note: inbound_campaign_calls uses different column names
  const { error: updateError } = await supabase
    .from("inbound_campaign_calls")
    .update({
      summary: result.summary,
      outcome_tag_id: outcomeTagId,
      sentiment: result.sentiment,
      key_points: result.keyPoints,
      caller_intent: result.callerIntent,
      resolution: result.resolution,
      ai_processed_at: new Date().toISOString(),
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", callId);

  if (updateError) {
    console.error("Failed to update inbound call with AI results:", updateError);
    await updateCallStatus(callId, "failed", "Failed to save AI results", "inbound");
  } else {
    // Track usage for billing after successful processing
    const clientId = call.inbound_campaigns?.client_id;
    if (clientId) {
      // Convert call duration from seconds to minutes
      const durationMinutes = call.duration_seconds
        ? Math.ceil(call.duration_seconds / 60)
        : 1; // Minimum 1 minute charge

      try {
        await trackCallUsage(clientId, callId, durationMinutes);
      } catch (billingError) {
        // Log but don't fail the call processing
        console.error("Failed to track usage:", billingError);
      }
    }
  }
}

async function updateCallStatus(
  callId: string,
  status: string,
  errorMessage?: string,
  callType: CallType = "legacy"
): Promise<void> {
  const supabase = getSupabaseClient();
  const table = callType === "inbound" ? "inbound_campaign_calls" : "calls";
  await supabase
    .from(table)
    .update({
      status,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", callId);
}
