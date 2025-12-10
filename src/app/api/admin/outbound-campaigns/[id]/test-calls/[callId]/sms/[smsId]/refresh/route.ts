import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * POST /api/admin/outbound-campaigns/[id]/test-calls/[callId]/sms/[smsId]/refresh
 * Refresh SMS delivery status from Twilio API
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; callId: string; smsId: string }> }
) {
  try {
    const { id, callId, smsId } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createServiceClient();

    // Get the SMS record
    const { data: sms, error: smsError } = await supabase
      .from("campaign_sms")
      .select("id, twilio_sid, status, call_id, campaign_id")
      .eq("id", smsId)
      .eq("call_id", callId)
      .eq("campaign_id", id)
      .single();

    if (smsError || !sms) {
      return NextResponse.json({ error: "SMS record not found" }, { status: 404 });
    }

    if (!sms.twilio_sid) {
      return NextResponse.json(
        { error: "No Twilio SID found for this SMS" },
        { status: 400 }
      );
    }

    // Get Twilio credentials from environment
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: "Twilio credentials not configured" },
        { status: 500 }
      );
    }

    // Fetch message status from Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${sms.twilio_sid}.json`;
    const twilioResponse = await fetch(twilioUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    });

    if (!twilioResponse.ok) {
      const errorData = await twilioResponse.json().catch(() => ({}));
      console.error("[SMS Refresh] Twilio API error:", errorData);
      return NextResponse.json(
        { error: `Failed to fetch from Twilio: ${twilioResponse.status}` },
        { status: 500 }
      );
    }

    const twilioMessage = await twilioResponse.json();

    // Map Twilio status to our status
    let newStatus = sms.status;
    if (twilioMessage.status === "delivered") {
      newStatus = "delivered";
    } else if (twilioMessage.status === "undelivered" || twilioMessage.status === "failed") {
      newStatus = "failed";
    } else if (twilioMessage.status === "sent") {
      newStatus = "sent";
    }

    // Update the SMS record with Twilio data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      twilio_status: twilioMessage.status,
      updated_at: new Date().toISOString(),
    };

    // Update delivered_at if delivered
    if (twilioMessage.status === "delivered" && twilioMessage.date_updated) {
      updateData.delivered_at = new Date(twilioMessage.date_updated).toISOString();
    }

    // Update error info if failed
    if (twilioMessage.error_code) {
      updateData.twilio_error_code = twilioMessage.error_code.toString();
      updateData.twilio_error_message = twilioMessage.error_message || null;
    }

    // Update cost if available
    if (twilioMessage.price) {
      updateData.cost = Math.abs(parseFloat(twilioMessage.price)).toFixed(4);
    }

    const { error: updateError } = await supabase
      .from("campaign_sms")
      .update(updateData)
      .eq("id", smsId);

    if (updateError) {
      console.error("[SMS Refresh] Error updating record:", updateError);
      return NextResponse.json(
        { error: "Failed to update SMS record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated: true,
      sms: {
        id: smsId,
        status: newStatus,
        twilioStatus: twilioMessage.status,
        twilioSid: sms.twilio_sid,
        to: twilioMessage.to,
        from: twilioMessage.from,
        dateSent: twilioMessage.date_sent,
        dateUpdated: twilioMessage.date_updated,
        price: twilioMessage.price,
        priceUnit: twilioMessage.price_unit,
        errorCode: twilioMessage.error_code,
        errorMessage: twilioMessage.error_message,
      },
    });
  } catch (error) {
    console.error("Error refreshing SMS status:", error);
    return NextResponse.json(
      { error: "Failed to refresh SMS status" },
      { status: 500 }
    );
  }
}
