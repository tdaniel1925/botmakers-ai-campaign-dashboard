import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { getTimezoneFromAreaCode } from "@/lib/utils/area-code-timezone";

// Allow up to 60 seconds for large chunk uploads
export const maxDuration = 60;

interface ContactInput {
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  timezone?: string;
  custom_data?: Record<string, unknown>;
}

interface UploadResult {
  success: number;
  failed: number;
  duplicates: number;
  no_timezone: number;
  errors: Array<{ row: number; phone: string; error: string }>;
  timezone_breakdown: Record<string, number>;
}

/**
 * POST /api/admin/outbound-campaigns/[id]/contacts/upload
 * Upload contacts via CSV
 * Expects JSON body with:
 * - contacts: Array of contact objects
 * - column_mapping: Optional mapping of CSV columns to contact fields
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
    const { contacts, column_mapping } = body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: "No contacts provided" },
        { status: 400 }
      );
    }

    // Use service client to bypass RLS and potentially problematic triggers
    const supabase = await createServiceClient();

    // Verify campaign exists and is in draft status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status, total_contacts")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "draft" && campaign.status !== "paused") {
      return NextResponse.json(
        { error: "Contacts can only be uploaded to draft or paused campaigns" },
        { status: 400 }
      );
    }

    // Process contacts
    const result: UploadResult = {
      success: 0,
      failed: 0,
      duplicates: 0,
      no_timezone: 0,
      errors: [],
      timezone_breakdown: {},
    };

    const validContacts: Array<{
      campaign_id: string;
      phone_number: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      timezone?: string;
      custom_data: Record<string, unknown>;
      status: string;
    }> = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i] as ContactInput;
      const rowNumber = i + 1;

      // The frontend already maps columns and sends normalized field names
      // So we just read the direct properties
      const rawPhone = contact.phone_number || "";
      const firstName = contact.first_name || "";
      const lastName = contact.last_name || "";
      const email = contact.email || "";
      const customData = contact.custom_data || {};

      // Normalize phone number (in case frontend didn't normalize it)
      const normalizedPhone = normalizePhoneNumber(rawPhone);

      // Determine timezone: use explicit value from CSV, or auto-detect from area code
      const timezone = contact.timezone || (normalizedPhone ? getTimezoneFromAreaCode(normalizedPhone) : null) || undefined;

      if (!normalizedPhone) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          phone: rawPhone,
          error: "Invalid phone number format",
        });
        continue;
      }

      // Track timezone breakdown
      if (timezone) {
        result.timezone_breakdown[timezone] = (result.timezone_breakdown[timezone] || 0) + 1;
      } else {
        result.no_timezone++;
      }

      validContacts.push({
        campaign_id: id,
        phone_number: normalizedPhone,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        email: email || undefined,
        timezone: timezone,
        custom_data: customData,
        status: "pending",
      });
    }

    // Batch insert contacts (handle duplicates)
    if (validContacts.length > 0) {
      // Insert in batches of 500
      const batchSize = 500;
      for (let i = 0; i < validContacts.length; i += batchSize) {
        const batch = validContacts.slice(i, i + batchSize);

        const { data: inserted, error } = await supabase
          .from("campaign_contacts")
          .upsert(batch, {
            onConflict: "campaign_id,phone_number",
            ignoreDuplicates: true,
          })
          .select("id");

        if (error) {
          console.error("Batch insert error:", error);
          // Count these as failed
          result.failed += batch.length;
        } else {
          // Count successes vs duplicates
          const insertedCount = inserted?.length || 0;
          result.success += insertedCount;
          result.duplicates += batch.length - insertedCount;
        }
      }
    }

    // Update campaign total_contacts count
    const { count: newTotal } = await supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id);

    await supabase
      .from("outbound_campaigns")
      .update({
        total_contacts: newTotal || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "contacts_uploaded",
      resource_type: "outbound_campaign",
      resource_id: id,
      details: {
        total_rows: contacts.length,
        success: result.success,
        duplicates: result.duplicates,
        failed: result.failed,
      },
    });

    return NextResponse.json({
      success: true,
      result,
      total_contacts: newTotal,
    });
  } catch (error) {
    console.error("Error uploading contacts:", error);
    return NextResponse.json(
      { error: "Failed to upload contacts" },
      { status: 500 }
    );
  }
}

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX)
 * More lenient validation to handle various input formats
 */
function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  // Convert to string and trim
  const phoneStr = phone.toString().trim();
  if (!phoneStr) return null;

  // Remove all non-numeric characters except leading +
  const hasPlus = phoneStr.startsWith('+');
  const digits = phoneStr.replace(/\D/g, "");

  // Need at least 7 digits for a valid phone number
  if (digits.length < 7) return null;

  // Handle different formats
  if (digits.length === 10) {
    // US number without country code
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    // US number with country code
    return `+${digits}`;
  } else if (digits.length >= 7 && digits.length <= 15) {
    // International number or shorter number - accept it
    if (hasPlus || digits.length >= 10) {
      return `+${digits}`;
    }
    // Assume US for 7-digit numbers (local)
    return `+1${digits}`;
  }

  return null;
}
