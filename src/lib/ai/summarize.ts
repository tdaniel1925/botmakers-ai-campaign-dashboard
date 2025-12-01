import { summarizeCall, SummarizationResult } from "./deepseek";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function processCallWithAI(callId: string): Promise<void> {
  try {
    // Fetch the call record
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select(
        `
        *,
        campaigns (
          id,
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
      await updateCallStatus(callId, "failed", "Call not found");
      return;
    }

    if (!call.transcript) {
      await updateCallStatus(callId, "failed", "No transcript available");
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
      await updateCallStatus(callId, "failed", "AI summarization failed");
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
      await updateCallStatus(callId, "failed", "Failed to save AI results");
    }
  } catch (error) {
    console.error("Error processing call with AI:", error);
    await updateCallStatus(
      callId,
      "failed",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

async function updateCallStatus(
  callId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  await supabase
    .from("calls")
    .update({
      status,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", callId);
}
