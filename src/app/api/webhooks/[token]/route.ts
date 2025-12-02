import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processCallWithAI } from "@/lib/ai/summarize";
import { campaignRateLimiter, ipRateLimiter, aiQueue } from "@/lib/rate-limiter";

// Lazy init to avoid build-time errors when env vars aren't available
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  return "unknown";
}

// Auto-detect fields from common voice AI platforms (Vapi, AutoCalls.ai, etc.)
function autoDetectFields(payload: Record<string, unknown>) {
  // Helper to search for a value in nested objects
  function findValue(obj: unknown, keys: string[]): unknown {
    if (!obj || typeof obj !== "object") return undefined;

    const record = obj as Record<string, unknown>;

    // Check direct keys first
    for (const key of keys) {
      if (key in record && record[key] !== undefined && record[key] !== null && record[key] !== "") {
        return record[key];
      }
    }

    // Check nested paths (e.g., "message.transcript")
    for (const key of keys) {
      if (key.includes(".")) {
        const parts = key.split(".");
        let current: unknown = record;
        for (const part of parts) {
          if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[part];
          } else {
            current = undefined;
            break;
          }
        }
        if (current !== undefined && current !== null && current !== "") {
          return current;
        }
      }
    }

    // Search in nested objects (but not arrays)
    for (const value of Object.values(record)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const found = findValue(value, keys);
        if (found !== undefined) return found;
      }
    }

    return undefined;
  }

  // Common field names for each data type across platforms
  const transcriptKeys = [
    "transcript", "transcription", "text", "content", "message",
    "call_transcript", "conversation", "dialog",
    // Vapi specific
    "artifact.transcript",
    // AutoCalls specific
    "recording_transcript", "call_recording_transcript"
  ];

  const audioUrlKeys = [
    "recording_url", "recordingUrl", "audio_url", "audioUrl",
    "audio", "recording", "media_url", "mediaUrl",
    "stereo_recording_url", "stereoRecordingUrl",
    // Vapi specific
    "artifact.recordingUrl",
    // AutoCalls specific
    "call_recording_url", "recording_link"
  ];

  const phoneKeys = [
    "from", "phone", "caller", "phone_number", "phoneNumber",
    "caller_phone", "callerPhone", "customer_phone", "customerPhone",
    "from_number", "fromNumber", "caller_id", "callerId",
    // Vapi specific
    "customer.number",
    // AutoCalls specific
    "contact_phone", "lead_phone"
  ];

  const durationKeys = [
    "duration", "call_duration", "callDuration", "length",
    "duration_seconds", "durationSeconds", "duration_ms", "durationMs",
    "talk_time", "talkTime", "call_length", "callLength",
    // Vapi specific
    "artifact.duration",
    // AutoCalls specific
    "call_duration_seconds", "total_duration"
  ];

  const timestampKeys = [
    "timestamp", "created_at", "createdAt", "start_time", "startTime",
    "call_time", "callTime", "date", "datetime", "started_at", "startedAt",
    // Vapi specific
    "startedAt",
    // AutoCalls specific
    "call_start_time", "call_date"
  ];

  const callIdKeys = [
    "id", "call_id", "callId", "external_id", "externalId",
    "recording_id", "recordingId", "uuid", "call_uuid", "callUuid",
    // AutoCalls specific
    "call_reference", "unique_id"
  ];

  const statusKeys = [
    "status", "call_status", "callStatus", "disposition",
    "outcome", "result", "ended_reason", "endedReason",
    // Vapi specific
    "endedReason",
    // AutoCalls specific
    "call_outcome", "call_result"
  ];

  return {
    transcript: findValue(payload, transcriptKeys) as string | undefined,
    audioUrl: findValue(payload, audioUrlKeys) as string | undefined,
    callerPhone: findValue(payload, phoneKeys) as string | undefined,
    callDuration: findValue(payload, durationKeys) as number | string | undefined,
    timestamp: findValue(payload, timestampKeys) as string | undefined,
    externalCallId: findValue(payload, callIdKeys) as string | undefined,
    callStatus: findValue(payload, statusKeys) as string | undefined,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = getSupabaseClient();

  try {
    const { token } = await params;
    const clientIP = getClientIP(request);

    // Check IP rate limit first (500 req/min across all campaigns)
    const ipLimit = ipRateLimiter.isRateLimited(clientIP);
    if (ipLimit.limited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later.", resetIn: ipLimit.resetIn },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(ipLimit.resetIn / 1000).toString(),
            "X-RateLimit-Remaining": "0",
          }
        }
      );
    }

    // Check campaign rate limit (200 req/min per campaign)
    const campaignLimit = campaignRateLimiter.isRateLimited(token);
    if (campaignLimit.limited) {
      return NextResponse.json(
        { error: "Campaign rate limit exceeded. Try again later.", resetIn: campaignLimit.resetIn },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(campaignLimit.resetIn / 1000).toString(),
            "X-RateLimit-Remaining": "0",
          }
        }
      );
    }

    const payload = await request.json();

    // Find campaign by webhook token
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, is_active")
      .eq("webhook_token", token)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Invalid webhook token" },
        { status: 404 }
      );
    }

    if (!campaign.is_active) {
      return NextResponse.json(
        { error: "Campaign is inactive" },
        { status: 400 }
      );
    }

    // Auto-detect fields from payload (works with Vapi, AutoCalls.ai, etc.)
    const detected = autoDetectFields(payload);

    // Log what was detected for debugging
    console.log("Webhook received for campaign:", campaign.id);
    console.log("Auto-detected fields:", {
      hasTranscript: !!detected.transcript,
      hasAudio: !!detected.audioUrl,
      hasPhone: !!detected.callerPhone,
      hasDuration: !!detected.callDuration,
      hasTimestamp: !!detected.timestamp,
      hasCallId: !!detected.externalCallId,
    });

    // Validate - we need at least a transcript for AI analysis
    if (!detected.transcript || typeof detected.transcript !== "string") {
      await supabase.from("webhook_logs").insert({
        campaign_id: campaign.id,
        payload,
        status: "failed",
        error_message: "Could not find transcript in payload",
      });

      return NextResponse.json(
        {
          error: "Could not find transcript in payload",
          hint: "Ensure your voice AI platform includes the call transcript",
          detected: {
            transcript: null,
            audioUrl: detected.audioUrl ? "found" : null,
            phone: detected.callerPhone ? "found" : null,
            duration: detected.callDuration ? "found" : null,
          }
        },
        { status: 400 }
      );
    }

    // Parse duration
    let parsedDuration: number | null = null;
    if (detected.callDuration) {
      if (typeof detected.callDuration === "number") {
        parsedDuration = detected.callDuration;
      } else if (typeof detected.callDuration === "string") {
        parsedDuration = parseInt(detected.callDuration, 10);
        if (isNaN(parsedDuration)) {
          parsedDuration = null;
        }
      }
    }

    // Parse timestamp
    let parsedTimestamp: string | null = null;
    if (detected.timestamp) {
      try {
        parsedTimestamp = new Date(detected.timestamp).toISOString();
      } catch {
        parsedTimestamp = null;
      }
    }

    // Create call record with all raw data
    const { data: call, error: callError } = await supabase
      .from("calls")
      .insert({
        campaign_id: campaign.id,
        transcript: detected.transcript,
        audio_url: detected.audioUrl,
        caller_phone: detected.callerPhone,
        call_duration: parsedDuration,
        external_call_id: detected.externalCallId,
        raw_payload: payload,
        call_timestamp: parsedTimestamp,
        status: "processing",
      })
      .select()
      .single();

    if (callError || !call) {
      await supabase.from("webhook_logs").insert({
        campaign_id: campaign.id,
        payload,
        status: "failed",
        error_message: callError?.message || "Failed to create call record",
      });

      return NextResponse.json(
        { error: "Failed to create call record" },
        { status: 500 }
      );
    }

    // Log success
    await supabase.from("webhook_logs").insert({
      campaign_id: campaign.id,
      payload,
      status: "success",
    });

    // Queue AI processing
    aiQueue.add(call.id, () => processCallWithAI(call.id));

    return NextResponse.json({
      success: true,
      callId: call.id,
      message: "Call received and queued for AI processing",
      detected: {
        transcript: "found",
        audioUrl: detected.audioUrl ? "found" : null,
        phone: detected.callerPhone || null,
        duration: parsedDuration,
        callId: detected.externalCallId || null,
      }
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Allow GET for webhook verification (some platforms require this)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = getSupabaseClient();
  const { token } = await params;

  // Verify the token exists
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("webhook_token", token)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 404 });
  }

  return NextResponse.json({
    status: "active",
    campaign: campaign.name,
    message: "Webhook is ready. Send POST requests with call data including a transcript field.",
  });
}
