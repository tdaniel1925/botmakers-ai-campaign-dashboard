import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

interface CSVRow {
  phone_number?: string;
  phone?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  email?: string;
  [key: string]: string | undefined;
}

interface UploadResult {
  success: number;
  failed: number;
  duplicates: number;
  errors: Array<{ row: number; phone: string; error: string }>;
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

    if (contacts.length > 10000) {
      return NextResponse.json(
        { error: "Maximum 10,000 contacts per upload" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

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
      errors: [],
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
      const row = contacts[i] as CSVRow;
      const rowNumber = i + 1;

      // Extract fields using column mapping or default field names
      const phoneField = column_mapping?.phone_number || "phone_number";
      const firstNameField = column_mapping?.first_name || "first_name";
      const lastNameField = column_mapping?.last_name || "last_name";
      const emailField = column_mapping?.email || "email";

      const rawPhone =
        row[phoneField] || row.phone_number || row.phone || "";
      const firstName =
        row[firstNameField] || row.first_name || row.firstName || "";
      const lastName =
        row[lastNameField] || row.last_name || row.lastName || "";
      const email = row[emailField] || row.email || "";

      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(rawPhone);

      if (!normalizedPhone) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          phone: rawPhone,
          error: "Invalid phone number format",
        });
        continue;
      }

      // Build custom data (all fields not in standard mapping)
      const standardFields = [
        phoneField,
        firstNameField,
        lastNameField,
        emailField,
        "phone_number",
        "phone",
        "first_name",
        "firstName",
        "last_name",
        "lastName",
        "email",
      ];

      const customData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!standardFields.includes(key) && value) {
          customData[key] = value;
        }
      }

      // Get timezone from the row (client-side already derives from phone if not provided)
      const timezone = row.timezone || undefined;

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
 */
function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  // Remove all non-numeric characters
  const digits = phone.toString().replace(/\D/g, "");

  // Handle different formats
  if (digits.length === 10) {
    // US number without country code
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    // US number with country code
    return `+${digits}`;
  } else if (digits.length >= 11 && digits.length <= 15) {
    // International number
    return `+${digits}`;
  }

  return null;
}
