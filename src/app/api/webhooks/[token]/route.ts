import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processCallWithAI } from "@/lib/ai/summarize";
import { campaignRateLimiter, ipRateLimiter, aiQueue } from "@/lib/rate-limiter";
import { extractFieldsWithAI, applyMappings, type FieldMapping } from "@/lib/ai/payload-parser";

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

    // Find campaign by webhook token - include payload_mapping
    const { data: campaigns, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, is_active, payload_mapping")
      .eq("webhook_token", token)
      .limit(1);

    const campaign = campaigns?.[0];

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

    // Extract fields using saved mappings or AI
    let extractedFields;
    let usedMappings: FieldMapping | null = null;
    let isNewMapping = false;

    if (campaign.payload_mapping && Object.keys(campaign.payload_mapping).length > 0) {
      // Use saved mappings
      usedMappings = campaign.payload_mapping as FieldMapping;
      extractedFields = applyMappings(payload, usedMappings);
      console.log("Using saved field mappings for campaign:", campaign.id);
    } else {
      // Use AI to extract and suggest mappings
      console.log("Using AI extraction for campaign:", campaign.id);
      const aiResult = await extractFieldsWithAI(payload);
      extractedFields = aiResult.fields;
      usedMappings = aiResult.suggestedMappings;
      isNewMapping = true;

      // Save the AI-suggested mappings if they have good confidence
      if (aiResult.confidence >= 30) {
        await supabase
          .from("campaigns")
          .update({ payload_mapping: aiResult.suggestedMappings })
          .eq("id", campaign.id);
        console.log("Saved AI-suggested mappings with confidence:", aiResult.confidence);
      }
    }

    // Log what was extracted for debugging
    console.log("Webhook received for campaign:", campaign.id);
    console.log("Extracted fields:", {
      hasTranscript: !!extractedFields.transcript,
      hasAudio: !!extractedFields.audioUrl,
      hasPhone: !!extractedFields.callerPhone,
      hasDuration: !!extractedFields.callDuration,
      hasTimestamp: !!extractedFields.timestamp,
      hasCallId: !!extractedFields.externalCallId,
    });

    // If no transcript, treat as a ping/test request - acknowledge and return success
    if (!extractedFields.transcript) {
      await supabase.from("webhook_logs").insert({
        campaign_id: campaign.id,
        payload,
        status: "success",
        error_message: "Ping received (no transcript detected)",
      });

      return NextResponse.json({
        success: true,
        message: "Webhook connected successfully. Ready to receive calls with transcripts.",
        type: "ping",
        detected: {
          transcript: null,
          audioUrl: extractedFields.audioUrl ? "found" : null,
          phone: extractedFields.callerPhone ? "found" : null,
          duration: extractedFields.callDuration ? "found" : null,
        },
        mappings: usedMappings,
        isNewMapping,
      });
    }

    // Parse timestamp
    let parsedTimestamp: string | null = null;
    if (extractedFields.timestamp) {
      try {
        parsedTimestamp = new Date(extractedFields.timestamp).toISOString();
      } catch {
        parsedTimestamp = null;
      }
    }

    // Create call record with all extracted data
    const { data: call, error: callError } = await supabase
      .from("calls")
      .insert({
        campaign_id: campaign.id,
        transcript: extractedFields.transcript,
        audio_url: extractedFields.audioUrl,
        caller_phone: extractedFields.callerPhone,
        call_duration: extractedFields.callDuration,
        external_call_id: extractedFields.externalCallId,
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
        audioUrl: extractedFields.audioUrl ? "found" : null,
        phone: extractedFields.callerPhone || null,
        duration: extractedFields.callDuration,
        callId: extractedFields.externalCallId || null,
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
    message: "Webhook is ready. Send POST requests with call data - fields will be auto-detected using AI.",
  });
}
