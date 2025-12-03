import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { extractFieldsWithAI, flattenJson, type FieldMapping } from "@/lib/ai/payload-parser";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const { payload: payloadString } = body;

    if (!payloadString) {
      return NextResponse.json(
        { error: "Payload is required" },
        { status: 400 }
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadString);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Use AI to extract fields and suggest mappings
    const aiResult = await extractFieldsWithAI(payload);

    // Flatten the payload for easy visual display
    const flattenedPayload = flattenJson(payload);

    return NextResponse.json({
      mapping: aiResult.suggestedMappings,
      extracted: aiResult.fields,
      confidence: aiResult.confidence,
      flattenedPayload,
      campaignId,
    });
  } catch (error) {
    console.error("Error analyzing payload:", error);
    return NextResponse.json(
      { error: "Failed to analyze payload" },
      { status: 500 }
    );
  }
}

// Save custom mappings for a campaign
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const { mappings } = body as { mappings: FieldMapping };

    if (!mappings) {
      return NextResponse.json(
        { error: "Mappings are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("campaigns")
      .update({ payload_mapping: mappings })
      .eq("id", campaignId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Mappings saved successfully",
    });
  } catch (error) {
    console.error("Error saving mappings:", error);
    return NextResponse.json(
      { error: "Failed to save mappings" },
      { status: 500 }
    );
  }
}

// Get current mappings for a campaign
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id: campaignId } = await params;
    const supabase = await createClient();

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("payload_mapping")
      .eq("id", campaignId)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      mappings: campaign?.payload_mapping || null,
    });
  } catch (error) {
    console.error("Error getting mappings:", error);
    return NextResponse.json(
      { error: "Failed to get mappings" },
      { status: 500 }
    );
  }
}
