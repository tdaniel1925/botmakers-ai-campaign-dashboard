import { Resend } from 'resend';
import { db } from '@/db';
import { emailTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@botmakers.com';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'BotMakers Portal';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL || '/logo.png';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('[Email] RESEND_API_KEY not configured, skipping email send');
      console.log('[Email] Would send to:', params.to);
      console.log('[Email] Subject:', params.subject);
      return { success: true };
    }

    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[Email] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    };
  }
}

export async function sendCredentialsEmail(
  email: string,
  temporaryPassword: string,
  fullName?: string
): Promise<{ success: boolean; error?: string }> {
  // Try to get custom credentials template
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.type, 'credentials'),
        eq(emailTemplates.isDefault, true)
      )
    )
    .limit(1);

  const loginUrl = `${APP_URL}/login`;
  const name = fullName || email.split('@')[0];

  let subject: string;
  let html: string;

  if (template) {
    // Use custom template with variable replacement
    subject = template.subject
      .replace(/{{name}}/g, name)
      .replace(/{{email}}/g, email)
      .replace(/{{app_name}}/g, APP_NAME);

    html = template.htmlContent
      .replace(/{{name}}/g, name)
      .replace(/{{email}}/g, email)
      .replace(/{{password}}/g, temporaryPassword)
      .replace(/{{login_url}}/g, loginUrl)
      .replace(/{{app_name}}/g, APP_NAME)
      .replace(/{{logo_url}}/g, LOGO_URL);
  } else {
    // Default template
    subject = `Welcome to ${APP_NAME} - Your Login Credentials`;
    html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${APP_NAME}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${APP_NAME}</h1>
          </div>

          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Hello ${name},</p>

            <p style="font-size: 16px;">Your account has been created. Here are your login credentials:</p>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #e9ecef; padding: 2px 8px; border-radius: 4px; font-size: 14px;">${temporaryPassword}</code></p>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>Important:</strong> You will be required to change your password when you first log in.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">Log In to Your Account</a>
            </div>

            <p style="font-size: 14px; color: #666;">If you have any questions, please contact your administrator.</p>

            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
              This email was sent by ${APP_NAME}. If you did not expect this email, please ignore it.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  return sendEmail({ to: email, subject, html });
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  fullName?: string
): Promise<{ success: boolean; error?: string }> {
  const name = fullName || email.split('@')[0];

  const subject = `Reset Your ${APP_NAME} Password`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">Hello ${name},</p>

          <p style="font-size: 16px;">We received a request to reset your password. Click the button below to create a new password:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a>
          </div>

          <p style="font-size: 14px; color: #666;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>

          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

          <p style="font-size: 12px; color: #999; text-align: center;">
            This email was sent by ${APP_NAME}. If you did not request this, please ignore it.
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

export async function sendSalesWelcomeEmail(
  email: string,
  temporaryPassword: string,
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  const loginUrl = `${APP_URL}/sales/login`;
  const name = fullName || email.split('@')[0];

  const subject = `Welcome to the ${APP_NAME} Sales Team!`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to the Sales Team</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to the Team! 🎉</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">You've been invited to join ${APP_NAME}</p>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">Hello ${name},</p>

          <p style="font-size: 16px;">We're excited to have you on our sales team! Your account has been created and you're ready to start bringing in leads and earning commissions.</p>

          <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="margin: 0 0 15px 0; color: #059669;">Your Login Credentials</h3>
            <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #dcfce7; padding: 4px 10px; border-radius: 4px; font-size: 14px; font-weight: bold;">${temporaryPassword}</code></p>
          </div>

          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>⚠️ Important:</strong> You'll need to change your password when you first log in.</p>
          </div>

          <h3 style="color: #374151; margin-top: 25px;">What You Can Do in Your Sales Portal:</h3>
          <ul style="color: #6b7280; padding-left: 20px;">
            <li style="margin-bottom: 8px;"><strong>Manage Leads</strong> - Add, track, and nurture your prospects</li>
            <li style="margin-bottom: 8px;"><strong>Track Commissions</strong> - See your earnings and payment status</li>
            <li style="margin-bottom: 8px;"><strong>Access Resources</strong> - Download sales materials and product info</li>
            <li style="margin-bottom: 8px;"><strong>View Pipeline</strong> - Visualize your sales funnel</li>
            <li style="margin-bottom: 8px;"><strong>Performance Metrics</strong> - Track your sales performance</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">Log In to Your Portal</a>
          </div>

          <p style="font-size: 14px; color: #666;">If you have any questions, reach out to your administrator. We're here to help you succeed!</p>

          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

          <p style="font-size: 12px; color: #999; text-align: center;">
            This email was sent by ${APP_NAME}. If you did not expect this email, please contact your administrator.
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

// Generate a random temporary password
export function generateTemporaryPassword(length: number = 12): string {
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '23456789';
  const special = '!@#$%&*';
  const all = lowercase + uppercase + numbers + special;

  let password = '';

  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
