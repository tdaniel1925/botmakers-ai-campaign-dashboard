import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

interface CheckItem {
  id: string;
  name: string;
  description: string;
  status: "pending" | "checking" | "passed" | "failed" | "warning";
  message?: string;
  fixUrl?: string;
  required: boolean;
}

interface PreflightResult {
  ready: boolean;
  checks: CheckItem[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

/**
 * GET /api/admin/outbound-campaigns/[id]/preflight
 * Run pre-launch checks for a campaign
 * Returns detailed status of each requirement
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

    // Get campaign with all required data
    // Note: Use explicit relationship hint for campaign_phone_numbers due to ambiguous FK
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
        campaign_phone_numbers!campaign_phone_numbers_campaign_id_fkey (
          id,
          phone_number,
          provider,
          is_active
        ),
        campaign_schedules (
          id,
          days_of_week,
          start_time,
          end_time,
          timezone,
          is_active
        )
      `
      )
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
      console.error("[preflight] Campaign fetch error:", {
        id,
        fetchError,
        errorMessage: fetchError?.message,
        errorCode: fetchError?.code,
        errorDetails: fetchError?.details
      });
      return NextResponse.json(
        { error: "Campaign not found", details: fetchError?.message },
        { status: 404 }
      );
    }

    console.log("[preflight] Campaign found:", campaign.name);

    // Initialize checks array
    const checks: CheckItem[] = [];

    // Check 1: Campaign Status
    checks.push({
      id: "campaign_status",
      name: "Campaign Status",
      description: "Campaign must be in draft or scheduled status",
      status:
        campaign.status === "draft" || campaign.status === "scheduled"
          ? "passed"
          : "failed",
      message:
        campaign.status === "draft" || campaign.status === "scheduled"
          ? `Status: ${campaign.status}`
          : `Cannot launch - campaign is ${campaign.status}`,
      required: true,
    });

    // Check 2: Phone Numbers
    const activePhoneNumbers = campaign.campaign_phone_numbers?.filter(
      (p: { is_active: boolean }) => p.is_active
    );
    checks.push({
      id: "phone_numbers",
      name: "Phone Numbers",
      description: "At least one active phone number must be assigned",
      status: activePhoneNumbers?.length > 0 ? "passed" : "failed",
      message:
        activePhoneNumbers?.length > 0
          ? `${activePhoneNumbers.length} active phone number(s)`
          : "No active phone numbers",
      fixUrl: `/admin/outbound/${id}/phone-numbers`,
      required: true,
    });

    // Check 3: Schedule
    const activeSchedules = campaign.campaign_schedules?.filter(
      (s: { is_active: boolean }) => s.is_active
    );
    checks.push({
      id: "schedule",
      name: "Call Schedule",
      description: "At least one active schedule must be configured",
      status: activeSchedules?.length > 0 ? "passed" : "failed",
      message:
        activeSchedules?.length > 0
          ? `${activeSchedules.length} active schedule(s) configured`
          : "No active schedule configured",
      fixUrl: `/admin/outbound/${id}/schedule`,
      required: true,
    });

    // Check 4: Contacts
    const { count: pendingContactCount } = await supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "pending");

    const { count: totalContactCount } = await supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id);

    checks.push({
      id: "contacts",
      name: "Contacts",
      description: "At least one pending contact to call",
      status: (pendingContactCount || 0) > 0 ? "passed" : "failed",
      message:
        (pendingContactCount || 0) > 0
          ? `${pendingContactCount?.toLocaleString()} pending of ${totalContactCount?.toLocaleString()} total contacts`
          : totalContactCount && totalContactCount > 0
          ? `All ${totalContactCount} contacts have been processed - no pending contacts`
          : "No contacts uploaded",
      fixUrl: `/admin/outbound/${id}/contacts`,
      required: true,
    });

    // Check 5: Call Provider Configuration
    const hasProvider = !!campaign.call_provider;
    let providerConfigValid = false;
    let providerMessage = "No call provider selected";

    if (campaign.call_provider === "vapi") {
      if (campaign.vapi_key_source === "system") {
        providerConfigValid = !!campaign.vapi_assistant_id && !!campaign.vapi_phone_number_id;
        providerMessage = providerConfigValid
          ? "Vapi configured (system keys)"
          : "Missing Vapi assistant ID or phone number ID";
      } else {
        providerConfigValid =
          !!campaign.vapi_api_key &&
          !!campaign.vapi_assistant_id &&
          !!campaign.vapi_phone_number_id;
        providerMessage = providerConfigValid
          ? "Vapi configured (client keys)"
          : "Missing Vapi API key, assistant ID, or phone number ID";
      }
    } else if (campaign.call_provider === "autocalls") {
      providerConfigValid =
        !!campaign.provider_api_key && !!campaign.autocalls_assistant_id;
      providerMessage = providerConfigValid
        ? "AutoCalls.ai configured"
        : "Missing AutoCalls API key or assistant ID";
    } else if (campaign.call_provider === "synthflow") {
      providerConfigValid =
        !!campaign.provider_api_key && !!campaign.synthflow_model_id;
      providerMessage = providerConfigValid
        ? "Synthflow configured"
        : "Missing Synthflow API key or model ID";
    }

    checks.push({
      id: "call_provider",
      name: "Call Provider",
      description: "AI calling provider must be properly configured",
      status: hasProvider && providerConfigValid ? "passed" : "failed",
      message: providerMessage,
      fixUrl: `/admin/outbound/${id}`,
      required: true,
    });

    // Check 6: Agent Configuration
    const hasAgentConfig =
      campaign.agent_config && campaign.agent_config.systemPrompt;
    checks.push({
      id: "agent_config",
      name: "AI Agent Configuration",
      description: "System prompt must be configured for the AI agent",
      status: hasAgentConfig ? "passed" : "failed",
      message: hasAgentConfig
        ? "Agent system prompt configured"
        : "Missing AI agent system prompt",
      fixUrl: `/admin/outbound/${id}/agent`,
      required: true,
    });

    // Check 7: Certification (not required for test mode)
    const certificationRequired = !campaign.is_test_mode;
    const certificationAccepted = !!campaign.certification_accepted;

    if (certificationRequired) {
      checks.push({
        id: "certification",
        name: "Compliance Certification",
        description: "Compliance certification must be accepted for production campaigns",
        status: certificationAccepted ? "passed" : "failed",
        message: certificationAccepted
          ? "Certification accepted"
          : "Compliance certification required before launch",
        fixUrl: `/admin/outbound/${id}/certification`,
        required: true,
      });
    } else {
      checks.push({
        id: "certification",
        name: "Compliance Certification",
        description: "Test mode - certification not required",
        status: "passed",
        message: "Test mode enabled - certification bypassed",
        required: false,
      });
    }

    // Check 8: Payment Method (not required for test mode or if client has own API keys)
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

        checks.push({
          id: "payment_method",
          name: "Payment Method",
          description: "Valid payment method or client API keys required",
          status: paymentMethod ? "passed" : "failed",
          message: paymentMethod
            ? "Valid payment method on file"
            : "No valid payment method - client needs to add payment or Twilio API keys",
          required: true,
        });
      } else {
        checks.push({
          id: "payment_method",
          name: "Payment Method",
          description: "Client has their own Twilio API keys",
          status: "passed",
          message: "Client using own Twilio keys - no payment required",
          required: false,
        });
      }
    } else {
      checks.push({
        id: "payment_method",
        name: "Payment Method",
        description: "Test mode - payment not required",
        status: "passed",
        message: "Test mode enabled - payment bypassed",
        required: false,
      });
    }

    // Check 9: SMS Rules (optional - warning if none configured)
    const { count: smsRuleCount } = await supabase
      .from("outbound_campaign_sms_rules")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("is_active", true);

    checks.push({
      id: "sms_rules",
      name: "SMS Follow-up Rules",
      description: "Optional: Configure SMS rules for post-call follow-ups",
      status: (smsRuleCount || 0) > 0 ? "passed" : "warning",
      message:
        (smsRuleCount || 0) > 0
          ? `${smsRuleCount} active SMS rule(s)`
          : "No SMS rules configured - calls won't trigger SMS follow-ups",
      fixUrl: `/admin/outbound/${id}`,
      required: false,
    });

    // Check 10: Webhook (optional - info only)
    checks.push({
      id: "webhook",
      name: "Webhook Integration",
      description: "Optional: Webhook for real-time call updates",
      status: campaign.webhook_token ? "passed" : "warning",
      message: campaign.webhook_token
        ? "Webhook token generated"
        : "No webhook configured - consider setting up for integrations",
      required: false,
    });

    // Check 11: Test Mode Status (informational)
    checks.push({
      id: "test_mode",
      name: "Test Mode",
      description: campaign.is_test_mode
        ? `Limited to ${campaign.test_call_limit} test calls`
        : "Full production mode",
      status: "passed",
      message: campaign.is_test_mode
        ? `Test mode ON - will make up to ${campaign.test_call_limit} calls`
        : "Production mode - will call all pending contacts",
      required: false,
    });

    // Calculate summary
    const passed = checks.filter((c) => c.status === "passed").length;
    const failed = checks.filter((c) => c.status === "failed").length;
    const warnings = checks.filter((c) => c.status === "warning").length;

    // Campaign is ready if all required checks pass
    const ready = checks.filter((c) => c.required && c.status === "failed").length === 0;

    const result: PreflightResult = {
      ready,
      checks,
      summary: {
        total: checks.length,
        passed,
        failed,
        warnings,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error running preflight checks:", error);
    return NextResponse.json(
      { error: "Failed to run preflight checks" },
      { status: 500 }
    );
  }
}
