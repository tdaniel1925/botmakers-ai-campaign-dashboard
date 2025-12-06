import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { Resend } from "resend";

/**
 * POST /api/admin/crm/email/send
 * Send an email to a contact using Resend
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
      subject,
      html_body,
      text_body,
      from_email,
      from_name,
      reply_to,
      schedule_at,
    } = body;

    if (!contact_id) {
      return NextResponse.json(
        { error: "Contact ID is required" },
        { status: 400 }
      );
    }

    if (!template_id && !html_body && !text_body) {
      return NextResponse.json(
        { error: "Either template_id or email body is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get contact
    const { data: contact, error: contactError } = await supabase
      .from("crm_contacts")
      .select("id, client_id, email, first_name, last_name, do_not_email, do_not_contact")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (!contact.email) {
      return NextResponse.json(
        { error: "Contact has no email address" },
        { status: 400 }
      );
    }

    if (contact.do_not_email || contact.do_not_contact) {
      return NextResponse.json(
        { error: "Contact has opted out of email communications" },
        { status: 400 }
      );
    }

    // Get template if specified
    let emailSubject = subject;
    let emailHtml = html_body;
    let emailText = text_body;

    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from("crm_email_templates")
        .select("*")
        .eq("id", template_id)
        .single();

      if (templateError || !template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      emailSubject = subject || template.subject;
      emailHtml = template.html_body;
      emailText = template.text_body;
    }

    // Replace template variables
    const variables = {
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      full_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
      email: contact.email,
    };

    emailSubject = replaceVariables(emailSubject, variables);
    emailHtml = replaceVariables(emailHtml, variables);
    emailText = emailText ? replaceVariables(emailText, variables) : undefined;

    // Get Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      // Queue the email for later sending if no API key
      const { data: queued, error: queueError } = await supabase
        .from("crm_email_queue")
        .insert({
          contact_id,
          client_id: contact.client_id,
          template_id,
          from_email: from_email || "noreply@example.com",
          from_name: from_name || "AI Calling Dashboard",
          to_email: contact.email,
          to_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
          reply_to,
          subject: emailSubject,
          html_body: emailHtml,
          text_body: emailText,
          status: "pending",
          scheduled_at: schedule_at,
        })
        .select()
        .single();

      if (queueError) {
        console.error("Error queuing email:", queueError);
        return NextResponse.json({ error: queueError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        queued: true,
        message: "Email queued for sending (no Resend API key configured)",
        email_id: queued.id,
      });
    }

    // If scheduling for later, just queue it
    if (schedule_at && new Date(schedule_at) > new Date()) {
      const { data: queued, error: queueError } = await supabase
        .from("crm_email_queue")
        .insert({
          contact_id,
          client_id: contact.client_id,
          template_id,
          from_email: from_email || process.env.RESEND_FROM_EMAIL || "noreply@example.com",
          from_name: from_name || "AI Calling Dashboard",
          to_email: contact.email,
          to_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
          reply_to,
          subject: emailSubject,
          html_body: emailHtml,
          text_body: emailText,
          status: "scheduled",
          scheduled_at: schedule_at,
        })
        .select()
        .single();

      if (queueError) {
        console.error("Error scheduling email:", queueError);
        return NextResponse.json({ error: queueError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        scheduled: true,
        scheduled_at: schedule_at,
        email_id: queued.id,
      });
    }

    // Send email immediately via Resend
    const resend = new Resend(resendApiKey);
    const defaultFromEmail = process.env.RESEND_FROM_EMAIL || "noreply@example.com";

    try {
      const { data: sendResult, error: sendError } = await resend.emails.send({
        from: from_name
          ? `${from_name} <${from_email || defaultFromEmail}>`
          : from_email || defaultFromEmail,
        to: contact.email,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
        replyTo: reply_to,
      });

      if (sendError) {
        // Queue failed email
        await supabase.from("crm_email_queue").insert({
          contact_id,
          client_id: contact.client_id,
          template_id,
          from_email: from_email || defaultFromEmail,
          from_name,
          to_email: contact.email,
          to_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
          reply_to,
          subject: emailSubject,
          html_body: emailHtml,
          text_body: emailText,
          status: "failed",
          error_message: sendError.message,
        });

        return NextResponse.json(
          { error: `Failed to send email: ${sendError.message}` },
          { status: 500 }
        );
      }

      // Record sent email
      const { data: emailRecord, error: recordError } = await supabase
        .from("crm_email_queue")
        .insert({
          contact_id,
          client_id: contact.client_id,
          template_id,
          from_email: from_email || defaultFromEmail,
          from_name,
          to_email: contact.email,
          to_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
          reply_to,
          subject: emailSubject,
          html_body: emailHtml,
          text_body: emailText,
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_id: sendResult?.id,
        })
        .select()
        .single();

      if (recordError) {
        console.error("Error recording sent email:", recordError);
      }

      // Log activity
      await supabase.from("crm_activities").insert({
        contact_id,
        client_id: contact.client_id,
        activity_type: "email_sent",
        subject: `Email sent: ${emailSubject}`,
        body: emailText || "HTML email sent",
        performed_by: authResult.admin!.id,
        performed_by_name: authResult.admin!.name || authResult.admin!.email,
        completed_at: new Date().toISOString(),
        metadata: { resend_id: sendResult?.id },
      });

      // Update contact email stats
      await supabase
        .from("crm_contacts")
        .update({
          last_contacted_at: new Date().toISOString(),
          total_emails_sent: (contact as Record<string, unknown>).total_emails_sent
            ? ((contact as Record<string, unknown>).total_emails_sent as number) + 1
            : 1,
        })
        .eq("id", contact_id);

      return NextResponse.json({
        success: true,
        sent: true,
        email_id: emailRecord?.id,
        resend_id: sendResult?.id,
      });
    } catch (sendErr) {
      console.error("Resend send error:", sendErr);
      return NextResponse.json(
        { error: sendErr instanceof Error ? sendErr.message : "Failed to send email" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in email send:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
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
