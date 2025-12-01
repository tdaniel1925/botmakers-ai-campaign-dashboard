import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getNestedValue } from "@/lib/utils";
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

interface PayloadMapping {
  transcript?: string;
  audio_url?: string;
  caller_phone?: string;
  call_duration?: string;
  timestamp?: string;
  recording_id?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = getSupabaseClient();
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
      .select("id, is_active, payload_mapping")
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

    // Log the webhook
    await supabase.from("webhook_logs").insert({
      campaign_id: campaign.id,
      payload,
      status: "processing",
    });

    // Extract fields using payload mapping
    const mapping = (campaign.payload_mapping as PayloadMapping) || {};

    const transcript = getNestedValue(payload, mapping.transcript || "transcript");
    const audioUrl = getNestedValue(payload, mapping.audio_url);
    const callerPhone = getNestedValue(payload, mapping.caller_phone);
    const callDuration = getNestedValue(payload, mapping.call_duration);
    const timestamp = getNestedValue(payload, mapping.timestamp);
    const externalCallId = getNestedValue(payload, mapping.recording_id);

    // Validate transcript
    if (!transcript || typeof transcript !== "string") {
      await supabase.from("webhook_logs").insert({
        campaign_id: campaign.id,
        payload,
        status: "failed",
        error_message: "Missing or invalid transcript field",
      });

      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    // Parse duration if it's a string
    let parsedDuration: number | null = null;
    if (callDuration) {
      if (typeof callDuration === "number") {
        parsedDuration = callDuration;
      } else if (typeof callDuration === "string") {
        parsedDuration = parseInt(callDuration, 10);
        if (isNaN(parsedDuration)) {
          parsedDuration = null;
        }
      }
    }

    // Parse timestamp
    let parsedTimestamp: string | null = null;
    if (timestamp) {
      try {
        parsedTimestamp = new Date(timestamp as string).toISOString();
      } catch {
        parsedTimestamp = null;
      }
    }

    // Create call record
    const { data: call, error: callError } = await supabase
      .from("calls")
      .insert({
        campaign_id: campaign.id,
        transcript: transcript as string,
        audio_url: audioUrl as string | undefined,
        caller_phone: callerPhone as string | undefined,
        call_duration: parsedDuration,
        external_call_id: externalCallId as string | undefined,
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

    // Update webhook log to success
    await supabase
      .from("webhook_logs")
      .update({ status: "success" })
      .eq("campaign_id", campaign.id)
      .eq("status", "processing")
      .order("created_at", { ascending: false })
      .limit(1);

    // Queue AI processing with rate limiting (max 10 concurrent)
    aiQueue.add(call.id, () => processCallWithAI(call.id));

    return NextResponse.json({
      success: true,
      callId: call.id,
      message: "Call received and queued for processing",
      queuePosition: aiQueue.getQueueLength(),
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
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = getSupabaseClient();
  const { token } = await params;

  // Verify the token exists
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("webhook_token", token)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 404 });
  }

  return NextResponse.json({
    status: "active",
    message: "Webhook endpoint is ready to receive calls",
  });
}
