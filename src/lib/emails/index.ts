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

    // Determine recipient email - use explicit recipientEmail, or fall back to username if it's an email
    const recipientEmail = props.recipientEmail || (props.username.includes("@") ? props.username : null);

    if (!recipientEmail) {
      return { success: false, error: "No recipient email address provided" };
    }

    const { data, error } = await resend.emails.send({
      from: getSenderEmail(),
      to: recipientEmail,
      subject,
      html,
    });

    if (error) {
      await logEmail({
        clientId: props.clientId,
        templateSlug: "welcome",
        recipientEmail,
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
      recipientEmail,
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
 * Generic email sender interface for cron jobs
 */
export interface SendEmailParams {
  to: string;
  templateSlug: EmailTemplateType;
  data: Record<string, unknown>;
  clientId?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<EmailSendResult> {
  switch (params.templateSlug) {
    case "campaign_report":
      // Map cron data to expected email template props
      const totalCalls = params.data.totalCalls as number || 0;
      const positiveCalls = params.data.positiveCalls as number || 0;
      const positiveRate = totalCalls > 0 ? Math.round((positiveCalls / totalCalls) * 100) : 0;

      return sendCampaignReportEmail({
        recipientEmail: params.to,
        recipientName: params.data.clientName as string,
        reportPeriod: params.data.periodLabel as string,
        totalCalls: totalCalls,
        totalCampaigns: (params.data.campaignCount as number) || 1,
        overallPositiveRate: positiveRate,
        dashboardUrl: params.data.dashboardUrl as string,
        campaigns: [], // Simplified - no detailed campaign breakdown in scheduled reports
        clientId: params.clientId,
      });

    case "password_reset":
      return sendPasswordResetEmail({
        recipientEmail: params.to,
        recipientName: params.data.recipientName as string,
        username: params.data.username as string,
        newTempPassword: params.data.newTempPassword as string,
        loginUrl: params.data.loginUrl as string,
        clientId: params.clientId,
      });

    default:
      return { success: false, error: `Unknown template: ${params.templateSlug}` };
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
