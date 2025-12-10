import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { decrypt } from "@/lib/encryption";
import { processOutboundCallForSms } from "@/lib/sms/campaign-trigger";

/**
 * POST /api/admin/outbound-campaigns/[id]/test-calls/[callId]/sync
 * Sync call data from Vapi API and trigger SMS processing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; callId: string }> }
) {
  try {
    const { id, callId } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createServiceClient();

    // Get the call record and campaign
    const { data: call, error: callError } = await supabase
      .from("campaign_calls")
      .select(`
        *,
        campaign:outbound_campaigns(
          id,
          call_provider,
          vapi_api_key,
          vapi_key_source
        )
      `)
      .eq("id", callId)
      .eq("campaign_id", id)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (!call.vapi_call_id) {
      return NextResponse.json(
        { error: "No Vapi call ID found for this call" },
        { status: 400 }
      );
    }

    const campaign = call.campaign as {
      id: string;
      call_provider: string;
      vapi_api_key: string | null;
      vapi_key_source: string;
    };

    if (campaign.call_provider !== "vapi") {
      return NextResponse.json(
        { error: "Sync is only available for Vapi calls" },
        { status: 400 }
      );
    }

    // Get Vapi API key
    let apiKey: string;
    if (campaign.vapi_key_source === "system") {
      apiKey = process.env.VAPI_API_KEY || "";
      if (!apiKey) {
        return NextResponse.json(
          { error: "System Vapi API key is not configured" },
          { status: 500 }
        );
      }
    } else {
      if (!campaign.vapi_api_key) {
        return NextResponse.json(
          { error: "Vapi API key not configured for this campaign" },
          { status: 500 }
        );
      }
      apiKey = decrypt(campaign.vapi_api_key);
    }

    // Fetch call details from Vapi API
    console.log(`[Vapi Sync] Fetching call ${call.vapi_call_id} from Vapi API`);
    const vapiResponse = await fetch(
      `https://api.vapi.ai/call/${call.vapi_call_id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!vapiResponse.ok) {
      const errorData = await vapiResponse.json().catch(() => ({}));
      console.error("[Vapi Sync] Error fetching from Vapi:", errorData);
      return NextResponse.json(
        { error: `Failed to fetch from Vapi: ${vapiResponse.status}` },
        { status: 500 }
      );
    }

    const vapiCall = await vapiResponse.json();
    console.log("[Vapi Sync] Vapi call data:", JSON.stringify(vapiCall, null, 2));

    // Extract data from Vapi response
    const endedReason = vapiCall.endedReason || "unknown";

    // Duration calculation
    let durationSeconds: number | null = null;
    if (vapiCall.startedAt && vapiCall.endedAt) {
      const startTime = new Date(vapiCall.startedAt).getTime();
      const endTime = new Date(vapiCall.endedAt).getTime();
      if (!isNaN(startTime) && !isNaN(endTime)) {
        durationSeconds = Math.round((endTime - startTime) / 1000);
      }
    }

    // Cost
    let cost: number | null = null;
    if (vapiCall.cost !== undefined) {
      cost = typeof vapiCall.cost === "number" ? vapiCall.cost : parseFloat(vapiCall.cost);
    } else if (vapiCall.costBreakdown?.total !== undefined) {
      cost = vapiCall.costBreakdown.total;
    }

    // Recording URL
    const recordingUrl =
      vapiCall.artifact?.recordingUrl ||
      vapiCall.artifact?.stereoRecordingUrl ||
      vapiCall.recordingUrl ||
      null;

    // Transcript
    let transcript: string | null = null;
    if (vapiCall.artifact?.transcript) {
      transcript = vapiCall.artifact.transcript;
    } else if (vapiCall.artifact?.messages && Array.isArray(vapiCall.artifact.messages)) {
      transcript = vapiCall.artifact.messages
        .map((m: { role: string; message?: string; content?: string }) =>
          `${m.role}: ${m.message || m.content || ""}`
        )
        .join("\n");
    }

    // Analysis data
    const structuredData = vapiCall.analysis?.structuredData || null;
    const summary = vapiCall.analysis?.summary || null;

    // Determine outcome
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

    // Determine status
    let status: string;
    if (vapiCall.status === "ended" || vapiCall.status === "completed") {
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
    } else if (vapiCall.status === "in-progress") {
      status = "answered";
    } else if (vapiCall.status === "ringing") {
      status = "ringing";
    } else {
      status = vapiCall.status || call.status;
    }

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
      vapi_ended_reason: endedReason,
      updated_at: new Date().toISOString(),
    };

    if (vapiCall.startedAt) {
      updateData.answered_at = vapiCall.startedAt;
    }
    if (vapiCall.endedAt) {
      updateData.ended_at = vapiCall.endedAt;
    }

    console.log("[Vapi Sync] Updating call record with:", {
      ...updateData,
      transcript: transcript ? `${transcript.length} chars` : null,
    });

    const { error: updateError } = await supabase
      .from("campaign_calls")
      .update(updateData)
      .eq("id", callId);

    if (updateError) {
      console.error("[Vapi Sync] Error updating call record:", updateError);
      return NextResponse.json(
        { error: "Failed to update call record" },
        { status: 500 }
      );
    }

    // Process SMS rules if call completed with transcript
    let smsResult = null;
    if (transcript && status === "completed") {
      try {
        console.log(`[Vapi Sync] Processing SMS rules for call ${callId}`);
        smsResult = await processOutboundCallForSms(callId, id);
        console.log(`[Vapi Sync] SMS processing result:`, smsResult);
      } catch (smsError) {
        console.error(`[Vapi Sync] Error processing SMS:`, smsError);
        // Don't fail the sync if SMS processing fails
      }
    }

    return NextResponse.json({
      success: true,
      updated: true,
      call: {
        status,
        outcome,
        durationSeconds,
        hasTranscript: !!transcript,
        hasRecording: !!recordingUrl,
      },
      sms: smsResult
        ? {
            processed: smsResult.processed,
            sent: smsResult.sent,
            reason: smsResult.reason,
          }
        : null,
    });
  } catch (error) {
    console.error("Error syncing call from Vapi:", error);
    return NextResponse.json(
      { error: "Failed to sync call from Vapi" },
      { status: 500 }
    );
  }
}
