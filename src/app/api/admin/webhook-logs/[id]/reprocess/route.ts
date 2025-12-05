import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { processCallWithAI } from "@/lib/ai/summarize";
import { aiQueue } from "@/lib/rate-limiter";
import { extractFieldsWithAI } from "@/lib/ai/payload-parser";
import { auditLog } from "@/lib/audit-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify admin authentication
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: adminUser } = await supabaseAuth
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role client for operations
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the webhook log
    const { data: log, error: logError } = await supabase
      .from("webhook_logs")
      .select("*, campaigns(id, is_active, payload_mapping)")
      .eq("id", id)
      .single();

    if (logError || !log) {
      return NextResponse.json(
        { error: "Webhook log not found" },
        { status: 404 }
      );
    }

    // Check if campaign is active
    if (!log.campaigns?.is_active) {
      return NextResponse.json(
        { error: "Campaign is not active" },
        { status: 400 }
      );
    }

    // Re-extract fields from payload using AI
    const aiResult = await extractFieldsWithAI(log.payload);
    const extractedFields = aiResult.fields;

    // If no transcript, can't create a call
    if (!extractedFields.transcript) {
      return NextResponse.json(
        { error: "No transcript found in payload - cannot create call record" },
        { status: 400 }
      );
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

    // Create call record
    const { data: call, error: callError } = await supabase
      .from("calls")
      .insert({
        campaign_id: log.campaign_id,
        transcript: extractedFields.transcript,
        audio_url: extractedFields.audioUrl,
        caller_phone: extractedFields.callerPhone,
        call_duration: extractedFields.callDuration,
        external_call_id: extractedFields.externalCallId,
        raw_payload: log.payload,
        call_timestamp: parsedTimestamp,
        status: "processing",
      })
      .select()
      .single();

    if (callError || !call) {
      // Update webhook log with failure
      await supabase
        .from("webhook_logs")
        .update({
          status: "failed",
          error_message: `Reprocess failed: ${callError?.message || "Unknown error"}`,
        })
        .eq("id", id);

      return NextResponse.json(
        { error: "Failed to create call record" },
        { status: 500 }
      );
    }

    // Update webhook log to success
    await supabase
      .from("webhook_logs")
      .update({
        status: "success",
        error_message: `Reprocessed successfully - Call ID: ${call.id}`,
      })
      .eq("id", id);

    // Queue AI processing
    aiQueue.add(call.id, () => processCallWithAI(call.id));

    // Audit log the action
    auditLog.webhookReprocess(user.id, id);

    return NextResponse.json({
      success: true,
      message: "Webhook reprocessed successfully",
      callId: call.id,
      detected: {
        transcript: "found",
        audioUrl: extractedFields.audioUrl ? "found" : null,
        phone: extractedFields.callerPhone || null,
        duration: extractedFields.callDuration,
        callId: extractedFields.externalCallId || null,
      },
    });
  } catch (error) {
    console.error("Reprocess webhook error:", error);
    return NextResponse.json(
      { error: "Failed to reprocess webhook" },
      { status: 500 }
    );
  }
}
