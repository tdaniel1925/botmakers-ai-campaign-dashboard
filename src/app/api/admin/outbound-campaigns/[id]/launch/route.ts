import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { createVapiAssistant } from "@/lib/vapi/assistant";

/**
 * POST /api/admin/outbound-campaigns/[id]/launch
 * Launch an outbound campaign
 * - Validates all requirements are met
 * - Creates Vapi assistant if not exists
 * - Changes status to active
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

    const supabase = await createClient();

    // Get campaign with all required data
    const { data: campaign, error: fetchError } = await supabase
      .from("outbound_campaigns")
      .select(
        `
        *,
        clients (
          id,
          name,
          email
        ),
        campaign_phone_numbers (
          id,
          phone_number,
          provider,
          is_active
        ),
        campaign_schedules (
          id,
          is_active
        )
      `
      )
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Validate campaign status
    if (campaign.status === "active") {
      return NextResponse.json(
        { error: "Campaign is already active" },
        { status: 400 }
      );
    }

    if (campaign.status === "stopped" || campaign.status === "completed") {
      return NextResponse.json(
        { error: "Cannot launch a stopped or completed campaign. Create a new campaign instead." },
        { status: 400 }
      );
    }

    // Validation checks
    const errors: string[] = [];

    // Check phone number
    const activePhoneNumbers = campaign.campaign_phone_numbers?.filter(
      (p: { is_active: boolean }) => p.is_active
    );
    if (!activePhoneNumbers || activePhoneNumbers.length === 0) {
      errors.push("Campaign must have an active phone number assigned");
    }

    // Check schedule
    const activeSchedules = campaign.campaign_schedules?.filter(
      (s: { is_active: boolean }) => s.is_active
    );
    if (!activeSchedules || activeSchedules.length === 0) {
      errors.push("Campaign must have an active schedule configured");
    }

    // Check contacts
    const { count: contactCount } = await supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "pending");

    if (!contactCount || contactCount === 0) {
      errors.push("Campaign must have at least one pending contact to call");
    }

    // Check agent config
    if (!campaign.agent_config || !campaign.agent_config.systemPrompt) {
      errors.push("Campaign must have AI agent configuration (system prompt required)");
    }

    // Check certification (unless test mode)
    if (!campaign.is_test_mode && !campaign.certification_accepted) {
      errors.push("Compliance certification must be accepted before launching");
    }

    // Check payment method (unless test mode or client has own API keys)
    if (!campaign.is_test_mode) {
      // Check if client has their own Twilio keys
      const { data: clientApiKey } = await supabase
        .from("client_api_keys")
        .select("id")
        .eq("client_id", campaign.client_id)
        .eq("provider", "twilio")
        .eq("is_active", true)
        .single();

      if (!clientApiKey) {
        // Check for payment method
        const { data: paymentMethod } = await supabase
          .from("client_payment_methods")
          .select("id")
          .eq("client_id", campaign.client_id)
          .eq("is_valid", true)
          .single();

        if (!paymentMethod) {
          errors.push("Client must have a valid payment method or their own Twilio API keys");
        }
      }
    }

    // Return validation errors
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "Campaign validation failed",
          validation_errors: errors,
        },
        { status: 400 }
      );
    }

    // Create Vapi assistant if not exists
    let vapiAssistantId = campaign.vapi_assistant_id;

    if (!vapiAssistantId) {
      try {
        const assistant = await createVapiAssistant({
          name: `${campaign.name} - ${campaign.clients?.name || "Campaign"}`,
          systemPrompt: campaign.agent_config.systemPrompt,
          firstMessage: campaign.agent_config.firstMessage,
          voiceId: campaign.agent_config.voiceId,
          voiceProvider: campaign.agent_config.voiceProvider,
          endCallConditions: campaign.agent_config.endCallConditions,
          structuredDataSchema: campaign.structured_data_schema,
        });

        vapiAssistantId = assistant.id;
      } catch (vapiError) {
        console.error("Error creating Vapi assistant:", vapiError);
        return NextResponse.json(
          { error: "Failed to create AI assistant. Please check Vapi API configuration." },
          { status: 500 }
        );
      }
    }

    // Update campaign status to active
    const { data: updatedCampaign, error: updateError } = await supabase
      .from("outbound_campaigns")
      .update({
        status: "active",
        vapi_assistant_id: vapiAssistantId,
        launched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "campaign_launched",
      resource_type: "outbound_campaign",
      resource_id: id,
      details: {
        campaign_name: campaign.name,
        client_id: campaign.client_id,
        is_test_mode: campaign.is_test_mode,
        contact_count: contactCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Campaign launched successfully",
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error("Error launching outbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to launch campaign" },
      { status: 500 }
    );
  }
}
