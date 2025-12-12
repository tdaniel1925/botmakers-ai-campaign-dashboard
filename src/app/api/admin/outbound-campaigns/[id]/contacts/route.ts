import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/outbound-campaigns/[id]/contacts
 * List contacts for a campaign with pagination and filtering
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const outcome = searchParams.get("outcome");
    const idsOnly = searchParams.get("ids_only") === "true";
    const countOnly = searchParams.get("count_only") === "true";

    const supabase = await createServiceClient();

    // Verify campaign exists and get total_contacts for fast pagination
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, name, total_contacts")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // If requesting count only
    if (countOnly) {
      const hasFilters = status || outcome || search;

      // For very large campaigns (50K+) without filters, return cached count
      // Count queries on 100K+ rows can timeout
      if (!hasFilters && (campaign.total_contacts || 0) > 50000) {
        return NextResponse.json({
          count: campaign.total_contacts || 0,
        });
      }

      // For filtered queries or smaller campaigns, do actual count
      let countQuery = supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id);

      if (status) {
        countQuery = countQuery.eq("status", status);
      }
      if (outcome) {
        countQuery = countQuery.eq("outcome", outcome);
      }
      if (search) {
        countQuery = countQuery.or(
          `phone_number.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error("Count query error:", countError);
        // On timeout/error for large campaigns, fall back to cached count
        if ((campaign.total_contacts || 0) > 10000) {
          console.log("Falling back to cached total_contacts due to count error");
          return NextResponse.json({
            count: campaign.total_contacts || 0,
          });
        }
        return NextResponse.json({ error: countError.message }, { status: 500 });
      }

      return NextResponse.json({
        count: count || 0,
      });
    }

    // If requesting IDs only, fetch all matching contact IDs (for select all functionality)
    if (idsOnly) {
      // Supabase/PostgREST has a default max of 1000 rows per request
      // We need to paginate in batches of 1000 to get all IDs
      const allIds: string[] = [];
      const batchSize = 1000; // Match Supabase's default limit
      let offset = 0;
      let hasMore = true;
      let batchNum = 0;

      while (hasMore) {
        batchNum++;
        let idsQuery = supabase
          .from("campaign_contacts")
          .select("id")
          .eq("campaign_id", id)
          .order("created_at", { ascending: true }) // Consistent ordering for pagination
          .range(offset, offset + batchSize - 1);

        if (status) {
          idsQuery = idsQuery.eq("status", status);
        }
        if (outcome) {
          idsQuery = idsQuery.eq("outcome", outcome);
        }
        if (search) {
          idsQuery = idsQuery.or(
            `phone_number.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
          );
        }

        const { data: ids, error: idsError } = await idsQuery;

        if (idsError) {
          console.error("IDs query error:", idsError);
          return NextResponse.json({ error: idsError.message }, { status: 500 });
        }

        if (ids && ids.length > 0) {
          allIds.push(...ids.map((c) => c.id));
          console.log(`IDs batch ${batchNum}: fetched ${ids.length} IDs (offset ${offset}), total so far: ${allIds.length}`);
          offset += ids.length; // Use actual count returned, not batchSize
          // If we got fewer results than the batch size, we've reached the end
          hasMore = ids.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Total IDs fetched: ${allIds.length} in ${batchNum} batches`);
      return NextResponse.json({
        contact_ids: allIds,
        total: allIds.length,
      });
    }

    // For filtered queries on smaller campaigns, we can count; for large campaigns, use cached count
    const hasFilters = status || outcome || search;
    const isLargeCampaign = (campaign.total_contacts || 0) > 50000;

    // Build query - never use inline count for large campaigns (can timeout)
    // For smaller campaigns with filters, we can use inline count
    const useInlineCount = hasFilters && !isLargeCampaign;

    let query = supabase
      .from("campaign_contacts")
      .select(
        "id, campaign_id, phone_number, first_name, last_name, email, status, outcome, call_attempts, last_called_at, timezone, created_at",
        useInlineCount ? { count: "exact" } : undefined
      )
      .eq("campaign_id", id)
      .order("created_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (outcome) {
      query = query.eq("outcome", outcome);
    }
    if (search) {
      query = query.or(
        `phone_number.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: contacts, error, count } = await query;

    if (error) {
      console.error("Contacts query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate total:
    // - For unfiltered queries: use cached total_contacts
    // - For filtered queries on small campaigns: use inline count
    // - For filtered queries on large campaigns: estimate based on page data
    let total = campaign.total_contacts || 0;
    if (hasFilters) {
      if (useInlineCount) {
        total = count || 0;
      } else {
        // Large campaign with filters - estimate based on returned data
        // If we got a full page, there's likely more
        if (contacts && contacts.length < limit) {
          total = from + contacts.length;
        } else {
          // Show that there are more pages (at least)
          total = from + limit + 1;
        }
      }
    }

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/outbound-campaigns/[id]/contacts
 * Add a single contact to a campaign
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
    const { phone_number, first_name, last_name, email, custom_data } = body;

    if (!phone_number) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Verify campaign exists and is in draft status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status")
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
        { error: "Contacts can only be added to draft or paused campaigns" },
        { status: 400 }
      );
    }

    // Normalize phone number to E.164 format
    const normalizedPhone = normalizePhoneNumber(phone_number);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    // Insert contact (timezone will be auto-detected by database trigger)
    const { data: contact, error } = await supabase
      .from("campaign_contacts")
      .insert({
        campaign_id: id,
        phone_number: normalizedPhone,
        first_name,
        last_name,
        email,
        custom_data: custom_data || {},
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This phone number is already in the campaign" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update campaign contact count
    await supabase.rpc("increment_campaign_contacts", { campaign_id: id });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error adding contact:", error);
    return NextResponse.json(
      { error: "Failed to add contact" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/outbound-campaigns/[id]/contacts
 * Bulk delete contacts from a campaign
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

    const body = await request.json();
    const { contact_ids, delete_all_pending } = body;

    const supabase = await createServiceClient();

    // Verify campaign exists and is in draft status
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, status")
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
        { error: "Contacts can only be deleted from draft or paused campaigns" },
        { status: 400 }
      );
    }

    let deletedCount = 0;

    if (delete_all_pending) {
      // Count pending contacts first
      const { count } = await supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", "pending");

      // Delete all pending contacts
      const { error } = await supabase
        .from("campaign_contacts")
        .delete()
        .eq("campaign_id", id)
        .eq("status", "pending");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      deletedCount = count || 0;
    } else if (contact_ids && contact_ids.length > 0) {
      // Count matching contacts first
      const { count } = await supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", "pending")
        .in("id", contact_ids);

      // Delete specific contacts (only pending ones)
      const { error } = await supabase
        .from("campaign_contacts")
        .delete()
        .eq("campaign_id", id)
        .eq("status", "pending")
        .in("id", contact_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      deletedCount = count || 0;
    } else {
      return NextResponse.json(
        { error: "Either contact_ids or delete_all_pending must be provided" },
        { status: 400 }
      );
    }

    // Update campaign total_contacts count after deletion
    if (deletedCount > 0) {
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
    }

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
    });
  } catch (error) {
    console.error("Error deleting contacts:", error);
    return NextResponse.json(
      { error: "Failed to delete contacts" },
      { status: 500 }
    );
  }
}

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX)
 */
function normalizePhoneNumber(phone: string): string | null {
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, "");

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
