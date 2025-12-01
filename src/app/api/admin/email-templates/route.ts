import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lazy init to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Fetch all email templates
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data: templates, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST - Create a new email template
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    const { name, slug, subject, heading, bodyContent, buttonText, buttonUrl, footerText, primaryColor } = body;

    if (!name || !slug || !subject || !heading || !bodyContent) {
      return NextResponse.json(
        { error: "Missing required fields: name, slug, subject, heading, bodyContent" },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Template with this slug already exists" },
        { status: 400 }
      );
    }

    const { data: template, error } = await supabase
      .from("email_templates")
      .insert({
        name,
        slug,
        subject,
        heading,
        body_content: bodyContent,
        button_text: buttonText,
        button_url: buttonUrl,
        footer_text: footerText,
        primary_color: primaryColor || "#10B981",
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
