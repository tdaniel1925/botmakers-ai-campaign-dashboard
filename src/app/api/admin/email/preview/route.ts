import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { previewEmail, EmailTemplateType } from "@/lib/emails";

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templateType, props } = body;

    if (!templateType) {
      return NextResponse.json(
        { error: "Template type is required" },
        { status: 400 }
      );
    }

    // Get platform settings for logo
    const supabase = getSupabaseClient();
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("logo_url")
      .single();

    const html = await previewEmail(templateType as EmailTemplateType, {
      ...props,
      logoUrl: settings?.logo_url,
      loginUrl: props.loginUrl || `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      dashboardUrl: props.dashboardUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

    return NextResponse.json({ html });
  } catch (error) {
    console.error("Email preview error:", error);
    return NextResponse.json(
      { error: "Failed to generate email preview" },
      { status: 500 }
    );
  }
}
