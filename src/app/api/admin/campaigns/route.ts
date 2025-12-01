import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select(
        `
        *,
        clients (
          name,
          company_name
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, client_id } = body;

    if (!name || !client_id) {
      return NextResponse.json(
        { error: "Name and client are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Generate unique webhook token
    const webhookToken = nanoid(32);

    // Create campaign
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        name,
        description,
        client_id,
        webhook_token: webhookToken,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create default outcome tags
    const defaultTags = [
      { tag_name: "Interested", tag_color: "#22c55e", is_positive: true, sort_order: 0 },
      { tag_name: "Not Interested", tag_color: "#ef4444", is_positive: false, sort_order: 1 },
      { tag_name: "Call Back", tag_color: "#f59e0b", is_positive: true, sort_order: 2 },
      { tag_name: "Voicemail", tag_color: "#6b7280", is_positive: false, sort_order: 3 },
      { tag_name: "Wrong Number", tag_color: "#6b7280", is_positive: false, sort_order: 4 },
    ];

    await supabase.from("campaign_outcome_tags").insert(
      defaultTags.map((tag) => ({
        ...tag,
        campaign_id: campaign.id,
      }))
    );

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
