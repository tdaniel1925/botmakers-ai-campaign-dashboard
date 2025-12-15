import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { emailTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { generateTemporaryPassword } from '@/services/email-service';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'BotMakers Portal';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// POST /api/users/preview-email - Generate email preview for new user
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    const { email, fullName } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate the actual password that will be used
    const generatedPassword = generateTemporaryPassword();

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
    const password = generatedPassword;

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
        .replace(/{{password}}/g, password)
        .replace(/{{login_url}}/g, loginUrl)
        .replace(/{{app_name}}/g, APP_NAME);
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
                <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #e9ecef; padding: 2px 8px; border-radius: 4px; font-size: 14px;">${password}</code></p>
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

    return NextResponse.json({
      subject,
      html,
      to: email,
      from: APP_NAME,
      temporaryPassword: generatedPassword,
    });
  } catch (error) {
    console.error('[Users API] Preview email error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
