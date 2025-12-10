import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { encrypt } from "@/lib/encryption";

// Normalize phone number for comparison (strip all non-digits, ensure consistent format)
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  // Handle US numbers - normalize to 10 digits
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return cleaned.slice(1);
  }
  if (cleaned.length === 10) {
    return cleaned;
  }
  return cleaned;
}

/**
 * GET /api/admin/outbound-campaigns/[id]
 * Get a single outbound campaign with all related data
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

    const { data: campaign, error } = await supabase
      .from("outbound_campaigns")
      .select(
        `
        id,
        name,
        description,
        client_id,
        status,
        total_contacts,
        contacts_completed,
        is_test_mode,
        test_call_limit,
        rate_per_minute,
        billing_threshold,
        max_concurrent_calls,
        retry_enabled,
        retry_attempts,
        retry_delay_minutes,
        agent_config,
        structured_data_schema,
        created_at,
        updated_at,
        launched_at,
        scheduled_launch_at,
        scheduled_timezone,
        webhook_token,
        call_provider,
        vapi_key_source,
        vapi_assistant_id,
        vapi_phone_number_id,
        autocalls_assistant_id,
        synthflow_model_id,
        clients (
          id,
          name,
          company_name,
          email
        ),
        campaign_phone_numbers!campaign_phone_numbers_campaign_id_fkey (
          id,
          phone_number,
          friendly_name,
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

    if (error) {
      console.error("Error fetching campaign:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get contact and call stats in parallel for better performance
    const [
      { count: totalContacts },
      { count: pendingContacts },
      { count: completedContacts },
      { count: totalCalls },
      { count: positiveCalls },
    ] = await Promise.all([
      supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id),
      supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", "pending"),
      supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", "completed"),
      supabase
        .from("campaign_calls")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id),
      supabase
        .from("campaign_calls")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("outcome", "positive"),
    ]);

    // Get count of SMS opted-out contacts for this campaign
    // Join campaign_contacts with sms_blacklist to find contacts that have opted out
    const { data: optedOutContacts } = await supabase
      .from("campaign_contacts")
      .select(`
        id,
        phone
      `)
      .eq("campaign_id", id);

    let smsOptedOutCount = 0;
    if (optedOutContacts && optedOutContacts.length > 0) {
      // Get all blacklisted phone numbers
      const { data: blacklistedNumbers } = await supabase
        .from("sms_blacklist")
        .select("phone_number")
        .eq("is_active", true);

      if (blacklistedNumbers && blacklistedNumbers.length > 0) {
        // Create a set of blacklisted numbers for fast lookup (normalized)
        const blacklistSet = new Set(
          blacklistedNumbers.map((b) => normalizePhone(b.phone_number))
        );

        // Count contacts that are in the blacklist
        smsOptedOutCount = optedOutContacts.filter((contact) =>
          blacklistSet.has(normalizePhone(contact.phone || ""))
        ).length;
      }
    }

    return NextResponse.json({
      ...campaign,
      stats: {
        totalContacts: totalContacts || 0,
        pendingContacts: pendingContacts || 0,
        completedContacts: completedContacts || 0,
        totalCalls: totalCalls || 0,
        positiveCalls: positiveCalls || 0,
        positiveRate:
          totalCalls && totalCalls > 0
            ? ((positiveCalls || 0) / totalCalls) * 100
            : 0,
        smsOptedOutCount,
      },
    });
  } catch (error) {
    console.error("Error fetching outbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to fetch outbound campaign" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/outbound-campaigns/[id]
 * Update an outbound campaign (only allowed for draft campaigns)
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

    const supabase = await createClient();

    // Check campaign exists and is in draft status
    const { data: existingCampaign, error: fetchError } = await supabase
      .from("outbound_campaigns")
      .select("id, status")
      .eq("id", id)
      .single();

    if (fetchError || !existingCampaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Only draft or scheduled campaigns can be fully edited
    if (existingCampaign.status !== "draft" && existingCampaign.status !== "scheduled") {
      return NextResponse.json(
        {
          error:
            "Only draft or scheduled campaigns can be edited. Use pause/resume/stop for active campaigns.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      rate_per_minute,
      billing_threshold,
      max_concurrent_calls,
      retry_enabled,
      retry_attempts,
      retry_delay_minutes,
      is_test_mode,
      test_call_limit,
      agent_config,
      structured_data_schema,
      // Call provider selection
      call_provider,
      // Vapi credentials
      vapi_key_source,
      vapi_api_key,
      vapi_assistant_id,
      vapi_phone_number_id,
      // AutoCalls.ai credentials
      autocalls_assistant_id,
      // Synthflow credentials
      synthflow_model_id,
      // Provider API key (for AutoCalls/Synthflow)
      provider_api_key,
      // Variable mapping
      variable_mapping,
      // Scheduled launch
      scheduled_launch_at,
      scheduled_timezone,
      // Status (for canceling scheduled launch)
      status,
    } = body;

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (rate_per_minute !== undefined)
      updateData.rate_per_minute = rate_per_minute;
    if (billing_threshold !== undefined)
      updateData.billing_threshold = billing_threshold;
    if (max_concurrent_calls !== undefined)
      updateData.max_concurrent_calls = max_concurrent_calls;
    if (retry_enabled !== undefined) updateData.retry_enabled = retry_enabled;
    if (retry_attempts !== undefined)
      updateData.retry_attempts = retry_attempts;
    if (retry_delay_minutes !== undefined)
      updateData.retry_delay_minutes = retry_delay_minutes;
    if (is_test_mode !== undefined) updateData.is_test_mode = is_test_mode;
    if (test_call_limit !== undefined)
      updateData.test_call_limit = test_call_limit;
    if (agent_config !== undefined) updateData.agent_config = agent_config;
    if (structured_data_schema !== undefined)
      updateData.structured_data_schema = structured_data_schema;

    // Call provider selection
    if (call_provider !== undefined) updateData.call_provider = call_provider;

    // Vapi credentials
    if (vapi_key_source !== undefined) updateData.vapi_key_source = vapi_key_source;
    if (vapi_assistant_id !== undefined) updateData.vapi_assistant_id = vapi_assistant_id;
    if (vapi_phone_number_id !== undefined) updateData.vapi_phone_number_id = vapi_phone_number_id;

    // Encrypt Vapi API key if provided and using client keys
    if (vapi_api_key !== undefined) {
      if (vapi_api_key && vapi_key_source === "client") {
        try {
          updateData.vapi_api_key = encrypt(vapi_api_key);
        } catch (error) {
          console.error("Error encrypting Vapi API key:", error);
          return NextResponse.json(
            { error: "Failed to secure API key" },
            { status: 500 }
          );
        }
      } else {
        updateData.vapi_api_key = null;
      }
    }

    // AutoCalls.ai credentials
    if (autocalls_assistant_id !== undefined) {
      updateData.autocalls_assistant_id = autocalls_assistant_id ? parseInt(autocalls_assistant_id, 10) : null;
    }

    // Synthflow credentials
    if (synthflow_model_id !== undefined) updateData.synthflow_model_id = synthflow_model_id || null;

    // Provider API key (for AutoCalls/Synthflow)
    if (provider_api_key !== undefined) {
      if (provider_api_key && (call_provider === "autocalls" || call_provider === "synthflow")) {
        try {
          updateData.provider_api_key = encrypt(provider_api_key);
        } catch (error) {
          console.error("Error encrypting provider API key:", error);
          return NextResponse.json(
            { error: "Failed to secure provider API key" },
            { status: 500 }
          );
        }
      } else {
        updateData.provider_api_key = null;
      }
    }

    // Variable mapping
    if (variable_mapping !== undefined) updateData.variable_mapping = variable_mapping || {};

    // Scheduled launch - can set to null to cancel
    if (scheduled_launch_at !== undefined) {
      updateData.scheduled_launch_at = scheduled_launch_at || null;
      // If scheduling for the future, also set status to "scheduled"
      if (scheduled_launch_at) {
        updateData.status = "scheduled";
      }
    }

    // Scheduled timezone - stored for display purposes
    if (scheduled_timezone !== undefined) {
      updateData.scheduled_timezone = scheduled_timezone || null;
    }

    // Allow setting status to draft when canceling scheduled launch
    if (status !== undefined && status === "draft" && existingCampaign.status === "scheduled") {
      updateData.status = "draft";
    }

    updateData.updated_at = new Date().toISOString();

    const { data: campaign, error } = await supabase
      .from("outbound_campaigns")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error updating outbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to update outbound campaign" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/outbound-campaigns/[id]
 * Delete an outbound campaign (only allowed for draft campaigns)
 */
export async function DELETE(
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

    // Check campaign exists and is in draft status
    const { data: existingCampaign, error: fetchError } = await supabase
      .from("outbound_campaigns")
      .select("id, status, vapi_assistant_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingCampaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Only draft campaigns can be deleted
    if (existingCampaign.status !== "draft") {
      return NextResponse.json(
        {
          error:
            "Only draft campaigns can be deleted. Stop the campaign first if you need to remove it.",
        },
        { status: 400 }
      );
    }

    // Delete the campaign (cascade will handle related records)
    const { error } = await supabase
      .from("outbound_campaigns")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Campaign deleted" });
  } catch (error) {
    console.error("Error deleting outbound campaign:", error);
    return NextResponse.json(
      { error: "Failed to delete outbound campaign" },
      { status: 500 }
    );
  }
}
