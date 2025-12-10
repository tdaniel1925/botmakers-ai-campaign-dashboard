import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/client/outbound-campaigns/[id]/calls/[callId]/sms
 * Get SMS logs for a specific call (client view)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; callId: string }> }
) {
  try {
    const { id, callId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get client by email
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Verify campaign belongs to client
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id")
      .eq("id", id)
      .eq("client_id", client.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Verify call belongs to campaign
    const { data: call, error: callError } = await supabase
      .from("campaign_calls")
      .select("id")
      .eq("id", callId)
      .eq("campaign_id", id)
      .single();

    if (callError || !call) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    // Get SMS logs for this call
    const { data: smsLogs, error: smsError } = await supabase
      .from("campaign_sms")
      .select(`
        id,
        status,
        message_body,
        phone_number,
        recipient_name,
        twilio_status,
        segment_count,
        sent_at,
        delivered_at,
        created_at,
        rule:outbound_campaign_sms_rules(
          name
        )
      `)
      .eq("call_id", callId)
      .order("created_at", { ascending: false });

    if (smsError) {
      console.error("Error fetching SMS logs:", smsError);
      return NextResponse.json({ error: smsError.message }, { status: 500 });
    }

    // Transform the data for the frontend (simplified for client view)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedLogs = (smsLogs || []).map((sms: any) => {
      const rule = sms.rule as { name?: string } | null;
      return {
        id: sms.id,
        status: sms.status,
        twilioStatus: sms.twilio_status,
        messageBody: sms.message_body,
        phoneNumber: sms.phone_number,
        recipientName: sms.recipient_name,
        ruleName: rule?.name || null,
        segmentCount: sms.segment_count,
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
