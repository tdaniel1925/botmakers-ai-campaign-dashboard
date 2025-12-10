import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/webhooks/sms-receive
 * Twilio inbound SMS webhook
 *
 * Handles incoming SMS messages, primarily for opt-out (STOP) handling.
 * When someone texts STOP, they are added to the global SMS blacklist.
 *
 * Configure this URL in Twilio Console under your phone number's webhook settings.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data (Twilio sends application/x-www-form-urlencoded)
    const formData = await request.formData();

    // Extract key fields from Twilio webhook
    const messageSid = formData.get("MessageSid") as string;
    const from = formData.get("From") as string; // The sender's phone number
    const to = formData.get("To") as string; // Our Twilio number
    const body = (formData.get("Body") as string || "").trim();
    const accountSid = formData.get("AccountSid") as string;

    if (!from || !body) {
      console.error("[SMS Receive] Missing required fields:", { from, body });
      return new NextResponse(generateTwimlResponse(""), {
        status: 200,
        headers: { "Content-Type": "text/xml" }
      });
    }

    console.log(`[SMS Receive] From: ${from}, Body: "${body}"`);

    const supabase = await createServiceClient();

    // Check for opt-out keywords (case insensitive)
    const optOutKeywords = ["stop", "unsubscribe", "cancel", "end", "quit"];
    const optInKeywords = ["start", "unstop", "subscribe"];
    const helpKeywords = ["help", "info"];

    const normalizedBody = body.toLowerCase().trim();

    // Handle OPT-OUT
    if (optOutKeywords.includes(normalizedBody)) {
      console.log(`[SMS Receive] Opt-out request from ${from}`);

      // Add to global blacklist
      const { error: insertError } = await supabase
        .from("sms_blacklist")
        .upsert(
          {
            phone_number: from,
            is_active: true,
            opted_out_at: new Date().toISOString(),
            opt_out_source: "sms",
            opt_out_keyword: body,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "phone_number",
          }
        );

      if (insertError) {
        console.error("[SMS Receive] Error adding to blacklist:", insertError);
      } else {
        console.log(`[SMS Receive] Added ${from} to SMS blacklist`);
      }

      // Log the opt-out event
      await supabase.from("sms_opt_out_log").insert({
        phone_number: from,
        action: "opt_out",
        keyword: body,
        message_sid: messageSid,
        twilio_number: to,
        created_at: new Date().toISOString(),
      });

      // Send confirmation (required by TCPA)
      return new NextResponse(
        generateTwimlResponse("You have been unsubscribed and will not receive any more messages from us."),
        { status: 200, headers: { "Content-Type": "text/xml" } }
      );
    }

    // Handle OPT-IN (rejoin)
    if (optInKeywords.includes(normalizedBody)) {
      console.log(`[SMS Receive] Opt-in request from ${from}`);

      // Remove from blacklist (only admins can fully remove, but we can mark as user-requested)
      // For now, we'll just log this - admin review required to re-enable
      await supabase.from("sms_opt_out_log").insert({
        phone_number: from,
        action: "opt_in_request",
        keyword: body,
        message_sid: messageSid,
        twilio_number: to,
        created_at: new Date().toISOString(),
      });

      return new NextResponse(
        generateTwimlResponse("Your request to rejoin has been received. An administrator will review your request."),
        { status: 200, headers: { "Content-Type": "text/xml" } }
      );
    }

    // Handle HELP
    if (helpKeywords.includes(normalizedBody)) {
      return new NextResponse(
        generateTwimlResponse("Reply STOP to unsubscribe from messages. For support, contact us at our main phone number."),
        { status: 200, headers: { "Content-Type": "text/xml" } }
      );
    }

    // Log all other incoming messages
    await supabase.from("sms_inbound_log").insert({
      phone_number: from,
      twilio_number: to,
      message_body: body,
      message_sid: messageSid,
      account_sid: accountSid,
      created_at: new Date().toISOString(),
    });

    // No response for other messages
    return new NextResponse(generateTwimlResponse(""), {
      status: 200,
      headers: { "Content-Type": "text/xml" }
    });
  } catch (error) {
    console.error("[SMS Receive] Error:", error);
    // Still return 200 with empty TwiML to prevent Twilio from retrying
    return new NextResponse(generateTwimlResponse(""), {
      status: 200,
      headers: { "Content-Type": "text/xml" }
    });
  }
}

// Generate TwiML response
function generateTwimlResponse(message: string): string {
  if (!message) {
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Handle GET for testing/verification
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "SMS receive webhook endpoint is active",
    usage: "Configure this URL as the inbound SMS webhook in Twilio Console",
    keywords: {
      optOut: ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"],
      optIn: ["START", "UNSTOP", "SUBSCRIBE"],
      help: ["HELP", "INFO"],
    },
  });
}
