import { db } from '../src/db';
import { emailTemplates } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'VoiceMetrics Portal';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const templates = [
  // Credentials Email (for new user creation)
  {
    name: 'Default Credentials Email',
    type: 'credentials' as const,
    subject: `Welcome to ${APP_NAME} - Your Login Credentials`,
    isDefault: true,
    htmlContent: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to {{app_name}}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to {{app_name}}</h1>
    </div>

    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
      <p style="font-size: 16px;">Hello {{name}},</p>

      <p style="font-size: 16px;">Your account has been created. Here are your login credentials:</p>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Email:</strong> {{email}}</p>
        <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #e9ecef; padding: 2px 8px; border-radius: 4px; font-size: 14px;">{{password}}</code></p>
      </div>

      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #856404;"><strong>Important:</strong> You will be required to change your password when you first log in.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="{{login_url}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">Log In to Your Account</a>
      </div>

      <p style="font-size: 14px; color: #666;">If you have any questions, please contact your administrator.</p>

      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

      <p style="font-size: 12px; color: #999; text-align: center;">
        This email was sent by {{app_name}}. If you did not expect this email, please ignore it.
      </p>
    </div>
  </body>
</html>`,
  },

  // Welcome Email
  {
    name: 'Default Welcome Email',
    type: 'welcome' as const,
    subject: `Welcome to {{app_name}}!`,
    isDefault: true,
    htmlContent: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to {{app_name}}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to {{app_name}}!</h1>
    </div>

    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
      <p style="font-size: 16px;">Hello {{name}},</p>

      <p style="font-size: 16px;">Welcome aboard! We're excited to have you as part of the {{app_name}} community.</p>

      <p style="font-size: 16px;">Here's what you can do with your account:</p>

      <ul style="font-size: 16px; line-height: 1.8;">
        <li>View your campaign performance metrics</li>
        <li>Access call recordings and transcripts</li>
        <li>Track interaction history and analytics</li>
        <li>Generate and export reports</li>
      </ul>

      <p style="font-size: 16px;">If you have any questions or need assistance, don't hesitate to reach out to our support team.</p>

      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

      <p style="font-size: 12px; color: #999; text-align: center;">
        This email was sent by {{app_name}}.
      </p>
    </div>
  </body>
</html>`,
  },

  // Password Reset Email
  {
    name: 'Default Password Reset Email',
    type: 'password_reset' as const,
    subject: `{{app_name}} - Password Reset Request`,
    isDefault: true,
    htmlContent: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
    </div>

    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
      <p style="font-size: 16px;">Hello {{name}},</p>

      <p style="font-size: 16px;">We received a request to reset your password for your {{app_name}} account.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="{{reset_url}}" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Your Password</a>
      </div>

      <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e;"><strong>Security Notice:</strong> This link will expire in 24 hours. If you didn't request this reset, please ignore this email or contact support.</p>
      </div>

      <p style="font-size: 14px; color: #666;">If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
      <p style="font-size: 12px; color: #999; word-break: break-all;">{{reset_url}}</p>

      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

      <p style="font-size: 12px; color: #999; text-align: center;">
        This email was sent by {{app_name}}. If you did not request a password reset, please ignore this email.
      </p>
    </div>
  </body>
</html>`,
  },

  // Scheduled Report Email
  {
    name: 'Default Scheduled Report Email',
    type: 'scheduled_report' as const,
    subject: `{{app_name}} - Your {{report_type}} Report`,
    isDefault: true,
    htmlContent: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Report</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Your {{report_type}} Report</h1>
    </div>

    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
      <p style="font-size: 16px;">Hello {{name}},</p>

      <p style="font-size: 16px;">Your scheduled {{report_type}} report for {{date_range}} is ready.</p>

      <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #0369a1;">Report Summary</h3>
        <p style="margin: 0; color: #0c4a6e;">This report contains your campaign performance data, interaction metrics, and analytics for the selected period.</p>
      </div>

      <p style="font-size: 16px;">The full report is attached to this email. You can also view it in your dashboard.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="{{login_url}}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">View in Dashboard</a>
      </div>

      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

      <p style="font-size: 12px; color: #999; text-align: center;">
        You're receiving this email because you have scheduled reports enabled. You can adjust your report preferences in your profile settings.
      </p>
    </div>
  </body>
</html>`,
  },

  // Marketing Email
  {
    name: 'Default Marketing Email',
    type: 'marketing' as const,
    subject: `News from {{app_name}}`,
    isDefault: true,
    htmlContent: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>News from {{app_name}}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">{{app_name}} News</h1>
    </div>

    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
      <p style="font-size: 16px;">Hello {{name}},</p>

      <p style="font-size: 16px;">We have some exciting updates to share with you!</p>

      <!-- Add your marketing content here -->
      <div style="background: #f5f3ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #6d28d9;">What's New</h3>
        <ul style="margin: 0; padding-left: 20px; color: #5b21b6;">
          <li>New features and improvements</li>
          <li>Enhanced reporting capabilities</li>
          <li>Better performance and reliability</li>
        </ul>
      </div>

      <p style="font-size: 16px;">Log in to your account to explore these new features!</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="{{login_url}}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">Explore Now</a>
      </div>

      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

      <p style="font-size: 12px; color: #999; text-align: center;">
        You're receiving this email because you're subscribed to {{app_name}} updates.
        <br>
        <a href="#" style="color: #999;">Unsubscribe</a>
      </p>
    </div>
  </body>
</html>`,
  },
];

async function seedEmailTemplates() {
  console.log('🌱 Seeding email templates...\n');

  for (const template of templates) {
    try {
      // Check if a default template of this type already exists
      const existing = await db
        .select()
        .from(emailTemplates)
        .where(
          and(
            eq(emailTemplates.type, template.type),
            eq(emailTemplates.isDefault, true)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  Skipping ${template.type}: Default template already exists`);
        continue;
      }

      // Insert the template
      await db.insert(emailTemplates).values(template);
      console.log(`✅ Created: ${template.name} (${template.type})`);
    } catch (error) {
      console.error(`❌ Error creating ${template.name}:`, error);
    }
  }

  console.log('\n✨ Email template seeding complete!');
  process.exit(0);
}

seedEmailTemplates().catch((error) => {
  console.error('Failed to seed email templates:', error);
  process.exit(1);
});
