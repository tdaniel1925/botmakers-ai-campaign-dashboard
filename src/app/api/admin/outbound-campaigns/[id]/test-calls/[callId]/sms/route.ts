import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/outbound-campaigns/[id]/test-calls/[callId]/sms
 * Get SMS logs for a specific call
 */
export async function GET(
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

    // Verify the call belongs to this campaign
    const { data: call, error: callError } = await supabase
      .from("campaign_calls")
      .select("id, campaign_id")
      .eq("id", callId)
      .eq("campaign_id", id)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Get SMS logs for this call with rule details
    const { data: smsLogs, error: smsError } = await supabase
      .from("campaign_sms")
      .select(`
        id,
        status,
        message_body,
        phone_number,
        recipient_name,
        ai_evaluation_reason,
        ai_confidence,
        twilio_sid,
        twilio_status,
        twilio_error_code,
        twilio_error_message,
        segment_count,
        cost,
        sent_at,
        delivered_at,
        created_at,
        rule:outbound_campaign_sms_rules(
          id,
          name,
          trigger_condition
        )
      `)
      .eq("call_id", callId)
      .order("created_at", { ascending: false });

    if (smsError) {
      console.error("Error fetching SMS logs:", smsError);
      return NextResponse.json({ error: smsError.message }, { status: 500 });
    }

    // Transform the data for the frontend
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedLogs = (smsLogs || []).map((sms: any) => {
      const rule = sms.rule as { name?: string; trigger_condition?: string } | null;
      return {
        id: sms.id,
        status: sms.status,
        messageBody: sms.message_body,
        phoneNumber: sms.phone_number,
        recipientName: sms.recipient_name,
        ruleName: rule?.name || null,
        ruleCondition: rule?.trigger_condition || null,
        aiReason: sms.ai_evaluation_reason,
        aiConfidence: sms.ai_confidence ? parseFloat(sms.ai_confidence) : null,
        twilioSid: sms.twilio_sid,
        twilioStatus: sms.twilio_status,
        error: sms.twilio_error_message || (sms.twilio_error_code ? `Error code: ${sms.twilio_error_code}` : null),
        segmentCount: sms.segment_count,
        cost: sms.cost,
        sentAt: sms.sent_at,
        deliveredAt: sms.delivered_at,
        createdAt: sms.created_at,
      };
    });

    return NextResponse.json({
      smsLogs: transformedLogs,
      count: transformedLogs.length,
    });
  } catch (error) {
    console.error("Error fetching SMS logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch SMS logs" },
      { status: 500 }
    );
  }
}
