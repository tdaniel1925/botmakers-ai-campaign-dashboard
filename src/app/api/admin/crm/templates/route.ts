import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/crm/templates
 * List email and SMS templates
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "email" or "sms"
    const clientId = searchParams.get("client_id");
    const category = searchParams.get("category");

    const supabase = await createClient();

    // Get email templates
    let emailTemplates: unknown[] = [];
    if (!type || type === "email") {
      let emailQuery = supabase
        .from("crm_email_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (clientId) {
        emailQuery = emailQuery.or(`client_id.eq.${clientId},client_id.is.null`);
      }

      if (category) {
        emailQuery = emailQuery.eq("category", category);
      }

      const { data, error } = await emailQuery;
      if (error) {
        console.error("Error fetching email templates:", error);
      } else {
        emailTemplates = data || [];
      }
    }

    // Get SMS templates
    let smsTemplates: unknown[] = [];
    if (!type || type === "sms") {
      let smsQuery = supabase
        .from("crm_sms_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (clientId) {
        smsQuery = smsQuery.or(`client_id.eq.${clientId},client_id.is.null`);
      }

      if (category) {
        smsQuery = smsQuery.eq("category", category);
      }

      const { data, error } = await smsQuery;
      if (error) {
        console.error("Error fetching SMS templates:", error);
      } else {
        smsTemplates = data || [];
      }
    }

    return NextResponse.json({
      email_templates: emailTemplates,
      sms_templates: smsTemplates,
    });
  } catch (error) {
    console.error("Error in templates GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/crm/templates
 * Create a new email or SMS template
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const {
      type, // "email" or "sms"
      client_id,
      name,
      category,
      // Email-specific fields
      subject,
      html_body,
      text_body,
      // SMS-specific fields
      message,
    } = body;

    if (!type || !["email", "sms"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'email' or 'sms'" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    if (type === "email") {
      if (!subject || (!html_body && !text_body)) {
        return NextResponse.json(
          { error: "Email templates require subject and at least one body (html or text)" },
          { status: 400 }
        );
      }

      const { data: template, error } = await supabase
        .from("crm_email_templates")
        .insert({
          client_id,
          name,
          category,
          subject,
          html_body,
          text_body,
          created_by: authResult.admin!.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating email template:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(template, { status: 201 });
    } else {
      if (!message) {
        return NextResponse.json(
          { error: "SMS templates require a message" },
          { status: 400 }
        );
      }

      if (message.length > 1600) {
        return NextResponse.json(
          { error: "SMS message exceeds maximum length of 1600 characters" },
          { status: 400 }
        );
      }

      const { data: template, error } = await supabase
        .from("crm_sms_templates")
        .insert({
          client_id,
          name,
          category,
          message,
          character_count: message.length,
          created_by: authResult.admin!.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating SMS template:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(template, { status: 201 });
    }
  } catch (error) {
    console.error("Error in templates POST:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
