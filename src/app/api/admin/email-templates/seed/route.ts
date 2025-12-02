import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

// Lazy init to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const defaultTemplates = [
  {
    name: "Welcome Email",
    slug: "welcome",
    subject: "Welcome to {{companyName}} - Your Login Credentials",
    heading: "Welcome to {{companyName}}!",
    body_content: `Hi {{recipientName}},

Your account has been created for the {{companyName}} Call Analytics platform. You can now access powerful insights into your call campaigns, including AI-powered summaries, sentiment analysis, and outcome tracking.

**Your Login Credentials:**
- Username: {{username}}
- Temporary Password: {{tempPassword}}

You will be asked to change your password on first login.

If you have any questions or need assistance, please don't hesitate to reach out to our support team.

Best regards,
The {{companyName}} Team`,
    button_text: "Sign In to Your Account",
    button_url: "{{loginUrl}}",
    footer_text: "Security Tip: Never share your password with anyone. {{companyName}} will never ask for your password via email.",
    primary_color: "#10B981",
    is_active: true,
  },
  {
    name: "Campaign Report",
    slug: "campaign_report",
    subject: "Your Campaign Report - {{reportPeriod}}",
    heading: "Campaign Performance Report",
    body_content: `Hi {{recipientName}},

Here's your campaign performance summary for {{reportPeriod}}.

**Overview:**
- Total Calls: {{totalCalls}}
- Positive Outcomes: {{positiveOutcomes}}
- Average Call Duration: {{avgDuration}}

Check your dashboard for detailed insights and AI-powered analysis of each call.

Best regards,
The {{companyName}} Team`,
    button_text: "View Full Report",
    button_url: "{{dashboardUrl}}",
    footer_text: "You're receiving this email because you opted in for {{reportFrequency}} reports.",
    primary_color: "#10B981",
    is_active: true,
  },
  {
    name: "Password Reset",
    slug: "password_reset",
    subject: "Password Reset - {{companyName}}",
    heading: "Your Password Has Been Reset",
    body_content: `Hi {{recipientName}},

Your password has been reset by an administrator. Here are your new login credentials:

**New Credentials:**
- Username: {{username}}
- New Temporary Password: {{tempPassword}}

Please sign in and change your password immediately.

If you did not request this reset, please contact your administrator immediately.

Best regards,
The {{companyName}} Team`,
    button_text: "Sign In Now",
    button_url: "{{loginUrl}}",
    footer_text: "For security reasons, this password will need to be changed on your next login.",
    primary_color: "#EF4444",
    is_active: true,
  },
  {
    name: "Re-invite Email",
    slug: "re_invite",
    subject: "Reminder: Your {{companyName}} Account is Ready",
    heading: "Your Account is Waiting!",
    body_content: `Hi {{recipientName}},

This is a friendly reminder that your {{companyName}} Call Analytics account has been created and is ready for you to access.

**Your Login Credentials:**
- Username: {{username}}
- Temporary Password: {{tempPassword}}

Don't miss out on powerful insights into your call campaigns! Sign in today to explore AI-powered summaries, sentiment analysis, and real-time outcome tracking.

Best regards,
The {{companyName}} Team`,
    button_text: "Sign In to Your Account",
    button_url: "{{loginUrl}}",
    footer_text: "You will be asked to change your password on first login.",
    primary_color: "#F59E0B",
    is_active: true,
  },
];

// POST - Seed default templates
export async function POST() {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = getSupabaseClient();

    // Check which templates already exist
    const { data: existing } = await supabase
      .from("email_templates")
      .select("slug");

    const existingSlugs = new Set(existing?.map((t) => t.slug) || []);

    // Filter out templates that already exist
    const templatesToInsert = defaultTemplates.filter(
      (t) => !existingSlugs.has(t.slug)
    );

    if (templatesToInsert.length === 0) {
      return NextResponse.json({
        message: "All default templates already exist",
        inserted: 0,
      });
    }

    const { data: inserted, error } = await supabase
      .from("email_templates")
      .insert(templatesToInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Seeded ${inserted?.length || 0} templates`,
      inserted: inserted?.length || 0,
      templates: inserted,
    });
  } catch (error) {
    console.error("Error seeding templates:", error);
    return NextResponse.json(
      { error: "Failed to seed templates" },
      { status: 500 }
    );
  }
}
