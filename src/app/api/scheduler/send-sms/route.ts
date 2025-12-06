import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyQStashAndGetBody } from "@/lib/scheduler/verify-qstash";
import { sendSms } from "@/lib/sms/twilio";

interface SendSmsBody {
  campaignId: string;
  contactId: string;
  templateId: string;
  phoneNumber: string;
}

/**
 * POST /api/scheduler/send-sms
 * Send an SMS follow-up for an outbound campaign
 * Called by QStash scheduler
 */
export async function POST(request: NextRequest) {
  try {
    // Verify QStash signature and get body
    const result = await verifyQStashAndGetBody<SendSmsBody>(request);
    if ("error" in result) {
      return result.error;
    }
    const { campaignId, contactId, templateId, phoneNumber } = result.body;

    if (!campaignId || !contactId || !templateId || !phoneNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get campaign to check status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status, client_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.log(`Campaign ${campaignId} not found`);
      return NextResponse.json({ status: "campaign_not_found" });
    }

    // Only send SMS for active/paused/completed campaigns
    if (campaign.status === "draft" || campaign.status === "stopped") {
      console.log(`Campaign ${campaignId} is ${campaign.status}, skipping SMS`);
      return NextResponse.json({ status: "campaign_not_active" });
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from("campaign_sms_templates")
      .select("*")
      .eq("id", templateId)
      .eq("campaign_id", campaignId)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      console.log(`SMS template ${templateId} not found or inactive`);
      return NextResponse.json({ status: "template_not_found" });
    }

    // Get contact details for personalization
    const { data: contact } = await supabase
      .from("campaign_contacts")
      .select("first_name, last_name, email, custom_data")
      .eq("id", contactId)
      .single();

    // Get campaign phone number for sending
    const { data: phoneNumberRecord } = await supabase
      .from("campaign_phone_numbers")
      .select("phone_number")
      .eq("campaign_id", campaignId)
      .eq("is_active", true)
      .single();

    if (!phoneNumberRecord) {
      console.log(`No active phone number for campaign ${campaignId}`);
      return NextResponse.json({ status: "no_sender_phone" });
    }

    // Process template variables
    let messageBody = template.template_body;

    if (contact) {
      messageBody = messageBody
        .replace(/\{\{first_name\}\}/g, contact.first_name || "")
        .replace(/\{\{last_name\}\}/g, contact.last_name || "")
        .replace(/\{\{contact_name\}\}/g,
          `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "there"
        )
        .replace(/\{\{email\}\}/g, contact.email || "");

      // Process custom data variables
      if (contact.custom_data && typeof contact.custom_data === "object") {
        for (const [key, value] of Object.entries(contact.custom_data)) {
          const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
          messageBody = messageBody.replace(placeholder, String(value));
        }
      }
    }

    // Add link if configured
    if (template.link_url) {
      messageBody += `\n\n${template.link_url}`;
    }

    // Create SMS record
    const { data: smsRecord, error: smsError } = await supabase
      .from("campaign_sms")
      .insert({
        campaign_id: campaignId,
        contact_id: contactId,
        template_id: templateId,
        phone_number: phoneNumber,
        message_body: messageBody,
        status: "pending",
      })
      .select()
      .single();

    if (smsError) {
      console.error("Failed to create SMS record:", smsError);
      return NextResponse.json({ status: "failed_to_create_record" });
    }

    // Send the SMS
    const smsResult = await sendSms({
      to: phoneNumber,
      body: messageBody,
    });

    // Update SMS record with result
    const updateData: Record<string, unknown> = {
      status: smsResult.success ? "sent" : "failed",
      sent_at: smsResult.success ? new Date().toISOString() : null,
    };

    if (smsResult.success) {
      updateData.twilio_sid = smsResult.messageSid;
      updateData.segment_count = smsResult.segmentCount || 1;
    } else {
      updateData.error_message = smsResult.error;
    }

    await supabase
      .from("campaign_sms")
      .update(updateData)
      .eq("id", smsRecord.id);

    // Update template send count
    const { data: currentTemplate } = await supabase
      .from("campaign_sms_templates")
      .select("send_count")
      .eq("id", templateId)
      .single();

    await supabase
      .from("campaign_sms_templates")
      .update({
        send_count: (currentTemplate?.send_count || 0) + 1,
      })
      .eq("id", templateId);

    // Track billing if successful
    if (smsResult.success) {
      await trackSmsBilling(
        supabase,
        campaignId,
        campaign.client_id,
        smsRecord.id,
        smsResult.segmentCount || 1
      );
    }

    return NextResponse.json({
      status: smsResult.success ? "sent" : "failed",
      smsId: smsRecord.id,
      messageSid: smsResult.messageSid,
      error: smsResult.error,
    });
  } catch (error) {
    console.error("Error sending SMS:", error);
    return NextResponse.json(
      { error: "Failed to send SMS" },
      { status: 500 }
    );
  }
}

async function trackSmsBilling(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
  clientId: string,
  smsId: string,
  segmentCount: number
) {
  // Get campaign billing rate
  const { data: campaign } = await supabase
    .from("outbound_campaigns")
    .select("rate_per_minute")
    .eq("id", campaignId)
    .single();

  // Use a default SMS rate (typically fraction of call rate)
  const smsRate = 0.01; // $0.01 per segment

  const cost = smsRate * segmentCount;

  // Update campaign billing
  const { data: billing } = await supabase
    .from("campaign_billing")
    .select("id, current_usage")
    .eq("campaign_id", campaignId)
    .single();

  if (billing) {
    await supabase
      .from("campaign_billing")
      .update({
        current_usage: parseFloat(billing.current_usage || "0") + cost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", billing.id);
  }
}

