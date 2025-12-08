import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processCallWithAI } from "@/lib/ai/summarize";
import { campaignRateLimiter, ipRateLimiter, aiQueue, webhookDeduplicator } from "@/lib/rate-limiter";
import { extractFieldsWithAI, applyMappings, type FieldMapping } from "@/lib/ai/payload-parser";
import { logger } from "@/lib/logger";

// Request timeout for database operations (30 seconds)
const DB_TIMEOUT_MS = 30000;

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

// Helper to add timeout to promises
function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promiseLike),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Helper to get the correct webhook log table based on campaign type
function getWebhookLogTable(campaignTable: "campaigns" | "inbound_campaigns"): string {
  return campaignTable === "inbound_campaigns" ? "inbound_campaign_webhook_logs" : "webhook_logs";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  try {
    const { token } = await params;
    const clientIP = getClientIP(request);

    // Check IP rate limit first (500 req/min across all campaigns) - now async for Redis
    const ipLimit = await ipRateLimiter.isRateLimited(clientIP);
    if (ipLimit.limited) {
      logger.webhook.rateLimited(clientIP, "ip");
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

    // Check campaign rate limit (200 req/min per campaign) - now async for Redis
    const campaignLimit = await campaignRateLimiter.isRateLimited(token);
    if (campaignLimit.limited) {
      logger.webhook.rateLimited(token, "campaign");
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

    // Find campaign by webhook token - check both legacy campaigns and inbound_campaigns tables
    let campaign: { id: string; is_active: boolean; payload_mapping: Record<string, unknown> | null; table: "campaigns" | "inbound_campaigns" } | null = null;

    // Check if it's an inbound campaign token (starts with "ib_")
    if (token.startsWith("ib_")) {
      const { data: inboundCampaigns, error: inboundError } = await withTimeout(
        supabase
          .from("inbound_campaigns")
          .select("id, is_active, payload_mapping")
          .eq("webhook_token", token)
          .limit(1),
        DB_TIMEOUT_MS,
        "Inbound campaign lookup"
      );

      if (!inboundError && inboundCampaigns?.[0]) {
        campaign = { ...inboundCampaigns[0], table: "inbound_campaigns" };
      }
    } else {
      // Legacy campaigns table
      const { data: campaigns, error: campaignError } = await withTimeout(
        supabase
          .from("campaigns")
          .select("id, is_active, payload_mapping")
          .eq("webhook_token", token)
          .limit(1),
        DB_TIMEOUT_MS,
        "Campaign lookup"
      );

      if (!campaignError && campaigns?.[0]) {
        campaign = { ...campaigns[0], table: "campaigns" };
      }
    }

    if (!campaign) {
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
      usedMappings = campaign.payload_mapping as unknown as FieldMapping;
      extractedFields = applyMappings(payload, usedMappings);
      logger.debug("Using saved field mappings", { campaignId: campaign.id });
    } else {
      // Use AI to extract and suggest mappings
      logger.debug("Using AI extraction", { campaignId: campaign.id });
      const aiResult = await extractFieldsWithAI(payload);
      extractedFields = aiResult.fields;
      usedMappings = aiResult.suggestedMappings;
      isNewMapping = true;

      // Save the AI-suggested mappings if they have good confidence
      if (aiResult.confidence >= 30) {
        await supabase
          .from(campaign.table)
          .update({ payload_mapping: aiResult.suggestedMappings })
          .eq("id", campaign.id);
        logger.info("Saved AI-suggested mappings", { campaignId: campaign.id, confidence: aiResult.confidence });
      }
    }

    // Log what was extracted for debugging
    logger.webhook.received(campaign.id, {
      hasTranscript: !!extractedFields.transcript,
      hasAudio: !!extractedFields.audioUrl,
      hasPhone: !!extractedFields.callerPhone,
      hasDuration: !!extractedFields.callDuration,
      hasTimestamp: !!extractedFields.timestamp,
      hasCallId: !!extractedFields.externalCallId,
      isNewMapping,
    });

    // If no transcript, treat as a ping/test request - acknowledge and return success
    const webhookLogTable = getWebhookLogTable(campaign.table);
    if (!extractedFields.transcript) {
      await supabase.from(webhookLogTable).insert({
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

    // Check for duplicate webhook (idempotency)
    if (extractedFields.externalCallId) {
      const isDuplicate = await webhookDeduplicator.isDuplicate(
        campaign.id,
        extractedFields.externalCallId
      );

      if (isDuplicate) {
        logger.webhook.duplicate(campaign.id, extractedFields.externalCallId);

        // Log as duplicate but don't create a new call
        await supabase.from(webhookLogTable).insert({
          campaign_id: campaign.id,
          payload,
          status: "success",
          error_message: "Duplicate webhook (already processed)",
        });

        return NextResponse.json({
          success: true,
          message: "Webhook already processed (duplicate)",
          type: "duplicate",
          externalCallId: extractedFields.externalCallId,
        });
      }
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

    // Create call record with all extracted data (with timeout)
    // Use the correct table based on campaign type
    const callTable = campaign.table === "inbound_campaigns" ? "inbound_campaign_calls" : "calls";
    const callData = campaign.table === "inbound_campaigns"
      ? {
          campaign_id: campaign.id,
          transcript: extractedFields.transcript,
          audio_url: extractedFields.audioUrl,
          caller_phone: extractedFields.callerPhone,
          call_duration: extractedFields.callDuration,
          external_call_id: extractedFields.externalCallId,
          raw_payload: payload,
          call_timestamp: parsedTimestamp,
          status: "processing",
        }
      : {
          campaign_id: campaign.id,
          transcript: extractedFields.transcript,
          audio_url: extractedFields.audioUrl,
          caller_phone: extractedFields.callerPhone,
          call_duration: extractedFields.callDuration,
          external_call_id: extractedFields.externalCallId,
          raw_payload: payload,
          call_timestamp: parsedTimestamp,
          status: "processing",
        };

    const { data: call, error: callError } = await withTimeout(
      supabase
        .from(callTable)
        .insert(callData)
        .select()
        .single(),
      DB_TIMEOUT_MS,
      "Call insert"
    );

    if (callError || !call) {
      await supabase.from(webhookLogTable).insert({
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
    await supabase.from(webhookLogTable).insert({
      campaign_id: campaign.id,
      payload,
      status: "success",
    });

    // Queue AI processing
    aiQueue.add(call.id, () => processCallWithAI(call.id));

    const processingTime = Date.now() - startTime;
    logger.webhook.processed(campaign.id, call.id, processingTime);

    return NextResponse.json({
      success: true,
      callId: call.id,
      message: "Call received and queued for AI processing",
      processingTimeMs: processingTime,
      detected: {
        transcript: "found",
        audioUrl: extractedFields.audioUrl ? "found" : null,
        phone: extractedFields.callerPhone || null,
        duration: extractedFields.callDuration,
        callId: extractedFields.externalCallId || null,
      }
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.webhook.failed("unknown", error, { processingTimeMs: processingTime });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        processingTimeMs: processingTime,
      },
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

  // Verify the token exists - check both tables
  let campaign: { id: string; name: string } | null = null;

  if (token.startsWith("ib_")) {
    // Inbound campaign
    const { data } = await supabase
      .from("inbound_campaigns")
      .select("id, name")
      .eq("webhook_token", token)
      .single();
    campaign = data;
  } else {
    // Legacy campaign
    const { data } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("webhook_token", token)
      .single();
    campaign = data;
  }

  if (!campaign) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 404 });
  }

  return NextResponse.json({
    status: "active",
    campaign: campaign.name,
    message: "Webhook is ready. Send POST requests with call data - fields will be auto-detected using AI.",
  });
}
