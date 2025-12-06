import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { decrypt } from "@/lib/encryption";

interface TwilioKeys {
  accountSid: string;
  authToken: string;
  phoneNumber?: string;
}

/**
 * Get Twilio credentials for a client or use system defaults
 */
async function getTwilioCredentials(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string
): Promise<TwilioKeys | null> {
  // First try client-specific Twilio keys
  const { data: clientKeys } = await supabase
    .from("client_api_keys")
    .select("account_sid, api_secret, extra_config")
    .eq("client_id", clientId)
    .eq("provider", "twilio")
    .eq("is_active", true)
    .single();

  if (clientKeys?.account_sid && clientKeys?.api_secret) {
    let authToken = clientKeys.api_secret;
    try {
      if (authToken.includes(":")) {
        authToken = decrypt(authToken);
      }
    } catch {
      // Use as-is if decryption fails
    }

    const extraConfig = clientKeys.extra_config as Record<string, unknown> | null;
    return {
      accountSid: clientKeys.account_sid,
      authToken,
      phoneNumber: extraConfig?.sms_phone_number as string | undefined,
    };
  }

  // Fall back to system Twilio credentials
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    return null;
  }

  return { accountSid, authToken, phoneNumber };
}

/**
 * POST /api/admin/crm/sms/send
 * Send an SMS to a contact using Twilio
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const {
      contact_id,
      template_id,
      message,
      from_number,
      schedule_at,
    } = body;

    if (!contact_id) {
      return NextResponse.json(
        { error: "Contact ID is required" },
        { status: 400 }
      );
    }

    if (!template_id && !message) {
      return NextResponse.json(
        { error: "Either template_id or message is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get contact
    const { data: contact, error: contactError } = await supabase
      .from("crm_contacts")
      .select("id, client_id, phone, first_name, last_name, do_not_sms, do_not_contact")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (!contact.phone) {
      return NextResponse.json(
        { error: "Contact has no phone number" },
        { status: 400 }
      );
    }

    if (contact.do_not_sms || contact.do_not_contact) {
      return NextResponse.json(
        { error: "Contact has opted out of SMS communications" },
        { status: 400 }
      );
    }

    // Get template if specified
    let smsMessage = message;

    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from("crm_sms_templates")
        .select("*")
        .eq("id", template_id)
        .single();

      if (templateError || !template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      smsMessage = template.message;
    }

    // Replace template variables
    const variables = {
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      full_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
      phone: contact.phone,
    };

    smsMessage = replaceVariables(smsMessage, variables);

    // Validate message length
    if (smsMessage.length > 1600) {
      return NextResponse.json(
        { error: "SMS message exceeds maximum length of 1600 characters" },
        { status: 400 }
      );
    }

    // Get Twilio credentials
    const twilioKeys = await getTwilioCredentials(supabase, contact.client_id);

    if (!twilioKeys) {
      // Queue the SMS for later sending if no credentials
      const { data: queued, error: queueError } = await supabase
        .from("crm_sms_queue")
        .insert({
          contact_id,
          client_id: contact.client_id,
          template_id,
          from_number: from_number || "pending",
          to_number: contact.phone,
          message: smsMessage,
          status: "pending",
          scheduled_at: schedule_at,
        })
        .select()
        .single();

      if (queueError) {
        console.error("Error queuing SMS:", queueError);
        return NextResponse.json({ error: queueError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        queued: true,
        message: "SMS queued for sending (no Twilio credentials configured)",
        sms_id: queued.id,
      });
    }

    const sendFromNumber = from_number || twilioKeys.phoneNumber;
    if (!sendFromNumber) {
      return NextResponse.json(
        { error: "No from phone number configured" },
        { status: 400 }
      );
    }

    // If scheduling for later, just queue it
    if (schedule_at && new Date(schedule_at) > new Date()) {
      const { data: queued, error: queueError } = await supabase
        .from("crm_sms_queue")
        .insert({
          contact_id,
          client_id: contact.client_id,
          template_id,
          from_number: sendFromNumber,
          to_number: contact.phone,
          message: smsMessage,
          status: "scheduled",
          scheduled_at: schedule_at,
        })
        .select()
        .single();

      if (queueError) {
        console.error("Error scheduling SMS:", queueError);
        return NextResponse.json({ error: queueError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        scheduled: true,
        scheduled_at: schedule_at,
        sms_id: queued.id,
      });
    }

    // Send SMS immediately via Twilio
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioKeys.accountSid}/Messages.json`;
      const auth = Buffer.from(`${twilioKeys.accountSid}:${twilioKeys.authToken}`).toString("base64");

      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: contact.phone,
          From: sendFromNumber,
          Body: smsMessage,
        }),
      });

      const twilioResponse = await response.json();

      if (!response.ok) {
        // Queue failed SMS
        await supabase.from("crm_sms_queue").insert({
          contact_id,
          client_id: contact.client_id,
          template_id,
          from_number: sendFromNumber,
          to_number: contact.phone,
          message: smsMessage,
          status: "failed",
          error_message: twilioResponse.message || "Unknown Twilio error",
        });

        return NextResponse.json(
          { error: `Failed to send SMS: ${twilioResponse.message || "Unknown error"}` },
          { status: 500 }
        );
      }

      // Record sent SMS
      const { data: smsRecord, error: recordError } = await supabase
        .from("crm_sms_queue")
        .insert({
          contact_id,
          client_id: contact.client_id,
          template_id,
          from_number: sendFromNumber,
          to_number: contact.phone,
          message: smsMessage,
          status: "sent",
          sent_at: new Date().toISOString(),
          twilio_sid: twilioResponse.sid,
          segments: twilioResponse.num_segments || 1,
        })
        .select()
        .single();

      if (recordError) {
        console.error("Error recording sent SMS:", recordError);
      }

      // Log activity
      await supabase.from("crm_activities").insert({
        contact_id,
        client_id: contact.client_id,
        activity_type: "sms_sent",
        subject: "SMS sent",
        body: smsMessage,
        performed_by: authResult.admin!.id,
        performed_by_name: authResult.admin!.name || authResult.admin!.email,
        completed_at: new Date().toISOString(),
        metadata: { twilio_sid: twilioResponse.sid },
      });

      // Update contact SMS stats
      await supabase
        .from("crm_contacts")
        .update({
          last_contacted_at: new Date().toISOString(),
          total_sms_sent: (contact as Record<string, unknown>).total_sms_sent
            ? ((contact as Record<string, unknown>).total_sms_sent as number) + 1
            : 1,
        })
        .eq("id", contact_id);

      return NextResponse.json({
        success: true,
        sent: true,
        sms_id: smsRecord?.id,
        twilio_sid: twilioResponse.sid,
        segments: twilioResponse.num_segments || 1,
      });
    } catch (sendErr) {
      console.error("Twilio send error:", sendErr);
      return NextResponse.json(
        { error: sendErr instanceof Error ? sendErr.message : "Failed to send SMS" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in SMS send:", error);
    return NextResponse.json(
      { error: "Failed to send SMS" },
      { status: 500 }
    );
  }
}

function replaceVariables(text: string, variables: Record<string, string>): string {
  if (!text) return text;

  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "gi"), value);
    result = result.replace(new RegExp(`{${key}}`, "gi"), value);
  }
  return result;
}
