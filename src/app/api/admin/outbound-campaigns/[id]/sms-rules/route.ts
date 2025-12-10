import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

interface SmsRule {
  id: string;
  campaign_id: string;
  name: string;
  trigger_condition: string;
  message_template: string;
  is_active: boolean;
  priority: number;
  trigger_count: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/admin/outbound-campaigns/[id]/sms-rules
 * Get all SMS rules for an outbound campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createServiceClient();

    // Verify campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, name")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Get SMS rules for this campaign
    const { data: rules, error: rulesError } = await supabase
      .from("outbound_campaign_sms_rules")
      .select("*")
      .eq("campaign_id", id)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });

    if (rulesError) {
      console.error("Error fetching SMS rules:", rulesError);
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }

    return NextResponse.json({
      rules: rules || [],
      count: rules?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching SMS rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch SMS rules" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/outbound-campaigns/[id]/sms-rules
 * Create a new SMS rule for an outbound campaign
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const { name, trigger_condition, message_template, is_active = true, priority = 0 } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!trigger_condition?.trim()) {
      return NextResponse.json({ error: "Trigger condition is required" }, { status: 400 });
    }
    if (!message_template?.trim()) {
      return NextResponse.json({ error: "Message template is required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Verify campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Create the SMS rule
    const { data: rule, error: createError } = await supabase
      .from("outbound_campaign_sms_rules")
      .insert({
        campaign_id: id,
        name: name.trim(),
        trigger_condition: trigger_condition.trim(),
        message_template: message_template.trim(),
        is_active,
        priority,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating SMS rule:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Error creating SMS rule:", error);
    return NextResponse.json(
      { error: "Failed to create SMS rule" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/outbound-campaigns/[id]/sms-rules
 * Update an existing SMS rule (expects ruleId in body)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const { ruleId, name, trigger_condition, message_template, is_active, priority } = body;

    if (!ruleId) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Verify rule exists and belongs to this campaign
    const { data: existingRule, error: ruleError } = await supabase
      .from("outbound_campaign_sms_rules")
      .select("id")
      .eq("id", ruleId)
      .eq("campaign_id", id)
      .single();

    if (ruleError || !existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Build update object with only provided fields
    const updateData: Partial<SmsRule> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (trigger_condition !== undefined) updateData.trigger_condition = trigger_condition.trim();
    if (message_template !== undefined) updateData.message_template = message_template.trim();
    if (is_active !== undefined) updateData.is_active = is_active;
    if (priority !== undefined) updateData.priority = priority;

    // Update the rule
    const { data: rule, error: updateError } = await supabase
      .from("outbound_campaign_sms_rules")
      .update(updateData)
      .eq("id", ruleId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating SMS rule:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Error updating SMS rule:", error);
    return NextResponse.json(
      { error: "Failed to update SMS rule" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/outbound-campaigns/[id]/sms-rules
 * Delete an SMS rule (expects ruleId in query params)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get("ruleId");

    if (!ruleId) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = await createServiceClient();

    // Verify rule exists and belongs to this campaign
    const { data: existingRule, error: ruleError } = await supabase
      .from("outbound_campaign_sms_rules")
      .select("id")
      .eq("id", ruleId)
      .eq("campaign_id", id)
      .single();

    if (ruleError || !existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Delete the rule
    const { error: deleteError } = await supabase
      .from("outbound_campaign_sms_rules")
      .delete()
      .eq("id", ruleId);

    if (deleteError) {
      console.error("Error deleting SMS rule:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting SMS rule:", error);
    return NextResponse.json(
      { error: "Failed to delete SMS rule" },
      { status: 500 }
    );
  }
}
