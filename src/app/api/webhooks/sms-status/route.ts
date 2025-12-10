import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/webhooks/sms-status
 * Twilio SMS delivery status webhook
 *
 * Twilio sends status updates to this endpoint when message status changes:
 * - queued: Message is queued for sending
 * - sending: Message is being sent
 * - sent: Message has been sent to carrier
 * - delivered: Message was delivered to recipient
 * - undelivered: Message could not be delivered
 * - failed: Message failed to send
 *
 * Configure this URL in Twilio Console or pass as StatusCallback when sending SMS
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data (Twilio sends application/x-www-form-urlencoded)
    const formData = await request.formData();

    // Extract key fields from Twilio webhook
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string | null;
    const errorMessage = formData.get("ErrorMessage") as string | null;
    const to = formData.get("To") as string;
    const from = formData.get("From") as string;

    if (!messageSid || !messageStatus) {
      console.error("[SMS Status Webhook] Missing required fields:", { messageSid, messageStatus });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log(`[SMS Status Webhook] ${messageSid}: ${messageStatus}`, {
      to,
      from,
      errorCode,
      errorMessage,
    });

    const supabase = await createServiceClient();
    const now = new Date().toISOString();

    // Update campaign_sms table (outbound campaigns)
    const { data: campaignSms, error: campaignError } = await supabase
      .from("campaign_sms")
      .update({
        status: messageStatus,
        delivered_at: messageStatus === "delivered" ? now : null,
        error_code: errorCode,
        error_message: errorMessage,
        updated_at: now,
      })
      .eq("twilio_sid", messageSid)
      .select("id")
      .maybeSingle();

    if (campaignError) {
      console.error("[SMS Status Webhook] Error updating campaign_sms:", campaignError);
    }

    // Also try sms_logs table (inbound campaigns / CRM)
    const { data: smsLog, error: logError } = await supabase
      .from("sms_logs")
      .update({
        status: messageStatus,
        delivered_at: messageStatus === "delivered" ? now : null,
        error_code: errorCode,
        error_message: errorMessage,
        updated_at: now,
      })
      .eq("twilio_sid", messageSid)
      .select("id")
      .maybeSingle();

    if (logError) {
      console.error("[SMS Status Webhook] Error updating sms_logs:", logError);
    }

    // Log if we didn't find the message in either table
    if (!campaignSms && !smsLog) {
      console.warn(`[SMS Status Webhook] Message ${messageSid} not found in database`);
    } else {
      console.log(`[SMS Status Webhook] Updated status for ${messageSid} to ${messageStatus}`);
    }

    // Twilio expects a 200 response
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[SMS Status Webhook] Error:", error);
    // Still return 200 to prevent Twilio from retrying
    return new NextResponse("OK", { status: 200 });
  }
}

// Handle GET for testing/verification
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "SMS status webhook endpoint is active",
    usage: "Configure this URL as StatusCallback in Twilio SMS API",
  });
}
