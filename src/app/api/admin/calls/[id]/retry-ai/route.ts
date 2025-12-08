import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { processCallWithAI, CallType } from "@/lib/ai/summarize";
import { aiQueue } from "@/lib/rate-limiter";
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

    // Try to find the call in legacy calls table first
    let call: { id: string; transcript: string | null } | null = null;
    let callType: CallType = "legacy";
    let tableName = "calls";

    const { data: legacyCall } = await supabase
      .from("calls")
      .select("id, transcript")
      .eq("id", id)
      .single();

    if (legacyCall) {
      call = legacyCall;
      callType = "legacy";
      tableName = "calls";
    } else {
      // Try inbound_campaign_calls table
      const { data: inboundCall } = await supabase
        .from("inbound_campaign_calls")
        .select("id, transcript")
        .eq("id", id)
        .single();

      if (inboundCall) {
        call = inboundCall;
        callType = "inbound";
        tableName = "inbound_campaign_calls";
      }
    }

    if (!call) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    // Check if call has transcript for AI processing
    if (!call.transcript) {
      return NextResponse.json(
        { error: "Call has no transcript to process" },
        { status: 400 }
      );
    }

    // Reset call status to processing
    await supabase
      .from(tableName)
      .update({
        status: "processing",
        ai_processed_at: null,
        error_message: null,
      })
      .eq("id", id);

    // Queue for AI processing with correct call type
    aiQueue.add(call.id, () => processCallWithAI(call.id, callType));

    // Audit log the action
    auditLog.aiRetry(user.id, id);

    return NextResponse.json({
      success: true,
      message: "Call queued for AI reprocessing",
      callId: id,
      callType,
    });
  } catch (error) {
    console.error("Retry AI processing error:", error);
    return NextResponse.json(
      { error: "Failed to retry AI processing" },
      { status: 500 }
    );
  }
}
