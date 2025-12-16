import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { generateTemporaryPassword } from '@/services/email-service';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'BotMakers Portal';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// POST /api/admin/sales-team/preview-email - Generate email preview for new sales user
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    const { email, fullName, password } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Use provided password or generate a new one
    const temporaryPassword = password || generateTemporaryPassword();
    const loginUrl = `${APP_URL}/sales`;
    const name = fullName || email.split('@')[0];

    const subject = `Welcome to the ${APP_NAME} Sales Team! 🎉`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${APP_NAME}</title>
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

    return NextResponse.json({
      subject,
      html,
      to: email,
      from: APP_NAME,
      temporaryPassword,
    });
  } catch (error) {
    console.error('[Sales Team API] Preview email error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
