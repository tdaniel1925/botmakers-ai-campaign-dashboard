import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lazy init to avoid build-time errors when env vars aren't available
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const aspectRatio = formData.get("aspectRatio") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const fileName = `platform-logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("logos")
      .getPublicUrl(fileName);

    const newLogoUrl = urlData.publicUrl;

    // Update platform settings
    const { data: existing } = await supabase
      .from("platform_settings")
      .select("id")
      .single();

    if (existing) {
      await supabase
        .from("platform_settings")
        .update({
          logo_url: newLogoUrl,
          logo_aspect_ratio: parseFloat(aspectRatio) || 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("platform_settings").insert({
        logo_url: newLogoUrl,
        logo_aspect_ratio: parseFloat(aspectRatio) || 1,
      });
    }

    return NextResponse.json({
      success: true,
      logoUrl: newLogoUrl,
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from("platform_settings")
      .update({
        logo_url: null,
        logo_aspect_ratio: null,
        updated_at: new Date().toISOString(),
      })
      .not("id", "is", null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logo delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
