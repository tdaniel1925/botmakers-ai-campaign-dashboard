import { Resend } from "resend";
import { render } from "@react-email/components";
import { createClient } from "@supabase/supabase-js";

import { WelcomeEmail, WelcomeEmailProps } from "./templates/welcome-email";
import {
  CampaignReportEmail,
  CampaignReportEmailProps,
} from "./templates/campaign-report-email";
import {
  PasswordResetEmail,
  PasswordResetEmailProps,
} from "./templates/password-reset-email";
import { ReInviteEmail, ReInviteEmailProps } from "./templates/re-invite-email";

// Lazy init to avoid build-time errors
function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Get platform settings (logo, etc.)
async function getPlatformSettings() {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("logo_url")
    .single();
  return data;
}

// Email template types
export type EmailTemplateType = "welcome" | "campaign_report" | "password_reset" | "re_invite";

// Email sending result
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Log email to database
async function logEmail(params: {
  clientId?: string;
  templateSlug: EmailTemplateType;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  status: "pending" | "sent" | "failed";
  resendMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseClient();
  await supabase.from("email_logs").insert({
    client_id: params.clientId,
    template_slug: params.templateSlug,
    recipient_email: params.recipientEmail,
    recipient_name: params.recipientName,
    subject: params.subject,
    status: params.status,
    resend_message_id: params.resendMessageId,
    error_message: params.errorMessage,
    metadata: params.metadata,
    sent_at: params.status === "sent" ? new Date().toISOString() : null,
  });
}

// Get sender email from env or default
function getSenderEmail() {
  return process.env.EMAIL_FROM || "BotMakers <noreply@botmakers.io>";
}

/**
 * Send Welcome Email with credentials
 */
export async function sendWelcomeEmail(
  props: WelcomeEmailProps & { clientId?: string }
): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: "Resend API key not configured" };
  }

  try {
    const settings = await getPlatformSettings();
    const emailProps: WelcomeEmailProps = {
      ...props,
      logoUrl: settings?.logo_url || props.logoUrl,
    };

    const html = await render(WelcomeEmail(emailProps));
    const subject = `Welcome to ${props.companyName || "BotMakers"} - Your Login Credentials`;

    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: props.username.includes("@") ? props.username : `${props.recipientName} <${props.loginUrl.includes("email=") ? new URL(props.loginUrl).searchParams.get("email") : ""}>`,
      subject,
      html,
    });

    if (error) {
      await logEmail({
        clientId: props.clientId,
        templateSlug: "welcome",
        recipientEmail: props.username,
        recipientName: props.recipientName,
        subject,
        status: "failed",
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }

    await logEmail({
      clientId: props.clientId,
      templateSlug: "welcome",
      recipientEmail: props.username,
      recipientName: props.recipientName,
      subject,
      status: "sent",
      resendMessageId: data?.id,
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Send Campaign Report Email
 */
export async function sendCampaignReportEmail(
  props: CampaignReportEmailProps & { clientId?: string; recipientEmail: string }
): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: "Resend API key not configured" };
  }

  try {
    const settings = await getPlatformSettings();
    const emailProps: CampaignReportEmailProps = {
      ...props,
      logoUrl: settings?.logo_url || props.logoUrl,
    };

    const html = await render(CampaignReportEmail(emailProps));
    const subject = `Your Campaign Report - ${props.reportPeriod}`;

    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: props.recipientEmail,
      subject,
      html,
    });

    if (error) {
      await logEmail({
        clientId: props.clientId,
        templateSlug: "campaign_report",
        recipientEmail: props.recipientEmail,
        recipientName: props.recipientName,
        subject,
        status: "failed",
        errorMessage: error.message,
        metadata: { reportPeriod: props.reportPeriod },
      });
      return { success: false, error: error.message };
    }

    await logEmail({
      clientId: props.clientId,
      templateSlug: "campaign_report",
      recipientEmail: props.recipientEmail,
      recipientName: props.recipientName,
      subject,
      status: "sent",
      resendMessageId: data?.id,
      metadata: { reportPeriod: props.reportPeriod },
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Send Password Reset Email
 */
export async function sendPasswordResetEmail(
  props: PasswordResetEmailProps & { clientId?: string; recipientEmail: string }
): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: "Resend API key not configured" };
  }

  try {
    const settings = await getPlatformSettings();
    const emailProps: PasswordResetEmailProps = {
      ...props,
      logoUrl: settings?.logo_url || props.logoUrl,
    };

    const html = await render(PasswordResetEmail(emailProps));
    const subject = `Password Reset - ${props.companyName || "BotMakers"}`;

    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: props.recipientEmail,
      subject,
      html,
    });

    if (error) {
      await logEmail({
        clientId: props.clientId,
        templateSlug: "password_reset",
        recipientEmail: props.recipientEmail,
        recipientName: props.recipientName,
        subject,
        status: "failed",
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }

    await logEmail({
      clientId: props.clientId,
      templateSlug: "password_reset",
      recipientEmail: props.recipientEmail,
      recipientName: props.recipientName,
      subject,
      status: "sent",
      resendMessageId: data?.id,
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Send Re-invite Email
 */
export async function sendReInviteEmail(
  props: ReInviteEmailProps & { clientId?: string; recipientEmail: string }
): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: "Resend API key not configured" };
  }

  try {
    const settings = await getPlatformSettings();
    const emailProps: ReInviteEmailProps = {
      ...props,
      logoUrl: settings?.logo_url || props.logoUrl,
    };

    const html = await render(ReInviteEmail(emailProps));
    const subject = `Reminder: Your ${props.companyName || "BotMakers"} Account is Ready`;

    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: props.recipientEmail,
      subject,
      html,
    });

    if (error) {
      await logEmail({
        clientId: props.clientId,
        templateSlug: "re_invite",
        recipientEmail: props.recipientEmail,
        recipientName: props.recipientName,
        subject,
        status: "failed",
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }

    await logEmail({
      clientId: props.clientId,
      templateSlug: "re_invite",
      recipientEmail: props.recipientEmail,
      recipientName: props.recipientName,
      subject,
      status: "sent",
      resendMessageId: data?.id,
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Preview email HTML without sending
 */
export async function previewEmail(
  templateType: EmailTemplateType,
  props: Record<string, unknown>
): Promise<string> {
  const settings = await getPlatformSettings();
  const baseProps = {
    ...props,
    logoUrl: settings?.logo_url || (props.logoUrl as string),
  };

  switch (templateType) {
    case "welcome":
      return render(WelcomeEmail(baseProps as WelcomeEmailProps));
    case "campaign_report":
      return render(CampaignReportEmail(baseProps as CampaignReportEmailProps));
    case "password_reset":
      return render(PasswordResetEmail(baseProps as PasswordResetEmailProps));
    case "re_invite":
      return render(ReInviteEmail(baseProps as ReInviteEmailProps));
    default:
      throw new Error(`Unknown template type: ${templateType}`);
  }
}
