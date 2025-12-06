import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/crm/contacts/[id]
 * Get a single CRM contact with full details
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

    const supabase = await createClient();

    // Get contact with related data
    const { data: contact, error } = await supabase
      .from("crm_contacts")
      .select(`
        *,
        assigned_admin:admin_users!crm_contacts_assigned_to_fkey(id, name, email),
        activities:crm_activities(
          id,
          activity_type,
          subject,
          body,
          performed_by_name,
          created_at
        ),
        tags:crm_tags(id, name, color),
        lists:crm_list_members(
          list:crm_lists(id, name, color)
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }
      console.error("Error fetching contact:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get recent calls for this contact
    const { data: calls } = await supabase
      .from("calls")
      .select("id, caller_number, call_type, duration, sentiment, created_at")
      .or(`caller_number.eq.${contact.phone},caller_number.eq.${contact.phone_secondary}`)
      .eq("client_id", contact.client_id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get recent emails sent
    const { data: emails } = await supabase
      .from("crm_email_queue")
      .select("id, subject, status, sent_at, opened_at, clicked_at, created_at")
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get recent SMS sent
    const { data: smsMessages } = await supabase
      .from("crm_sms_queue")
      .select("id, message, status, sent_at, delivered_at, created_at")
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      ...contact,
      calls: calls || [],
      emails: emails || [],
      sms_messages: smsMessages || [],
    });
  } catch (error) {
    console.error("Error in contact GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/crm/contacts/[id]
 * Update a CRM contact
 */
export async function PATCH(
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
    const {
      first_name,
      last_name,
      email,
      phone,
      phone_secondary,
      company,
      job_title,
      website,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      timezone,
      status,
      lead_source,
      pipeline_stage,
      assigned_to,
      tags,
      notes,
      custom_fields,
      lead_score,
      do_not_contact,
      do_not_email,
      do_not_call,
      do_not_sms,
    } = body;

    const supabase = await createClient();

    // Get current contact data for comparison
    const { data: currentContact, error: fetchError } = await supabase
      .from("crm_contacts")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !currentContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    const changes: string[] = [];

    if (first_name !== undefined && first_name !== currentContact.first_name) {
      updateData.first_name = first_name;
      changes.push(`First name changed to "${first_name}"`);
    }
    if (last_name !== undefined && last_name !== currentContact.last_name) {
      updateData.last_name = last_name;
      changes.push(`Last name changed to "${last_name}"`);
    }
    if (email !== undefined && email !== currentContact.email) {
      updateData.email = email;
      changes.push(`Email changed to "${email}"`);
    }
    if (phone !== undefined && phone !== currentContact.phone) {
      updateData.phone = normalizePhoneNumber(phone);
      changes.push(`Phone changed`);
    }
    if (phone_secondary !== undefined) updateData.phone_secondary = phone_secondary;
    if (company !== undefined) updateData.company = company;
    if (job_title !== undefined) updateData.job_title = job_title;
    if (website !== undefined) updateData.website = website;
    if (address_line1 !== undefined) updateData.address_line1 = address_line1;
    if (address_line2 !== undefined) updateData.address_line2 = address_line2;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (postal_code !== undefined) updateData.postal_code = postal_code;
    if (country !== undefined) updateData.country = country;
    if (timezone !== undefined) updateData.timezone = timezone;

    if (status !== undefined && status !== currentContact.status) {
      updateData.status = status;
      changes.push(`Status changed from "${currentContact.status}" to "${status}"`);
    }

    if (pipeline_stage !== undefined && pipeline_stage !== currentContact.pipeline_stage) {
      updateData.pipeline_stage = pipeline_stage;
      changes.push(`Pipeline stage changed from "${currentContact.pipeline_stage}" to "${pipeline_stage}"`);
    }

    if (lead_source !== undefined) updateData.lead_source = lead_source;
    if (lead_score !== undefined) updateData.lead_score = lead_score;

    if (assigned_to !== undefined && assigned_to !== currentContact.assigned_to) {
      updateData.assigned_to = assigned_to;
      updateData.assigned_at = assigned_to ? new Date().toISOString() : null;
      changes.push(assigned_to ? "Contact reassigned" : "Contact unassigned");
    }

    if (tags !== undefined) updateData.tags = tags;
    if (notes !== undefined) updateData.notes = notes;
    if (custom_fields !== undefined) {
      updateData.custom_fields = {
        ...currentContact.custom_fields,
        ...custom_fields,
      };
    }

    if (do_not_contact !== undefined) updateData.do_not_contact = do_not_contact;
    if (do_not_email !== undefined) updateData.do_not_email = do_not_email;
    if (do_not_call !== undefined) updateData.do_not_call = do_not_call;
    if (do_not_sms !== undefined) updateData.do_not_sms = do_not_sms;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Update contact
    const { data: contact, error } = await supabase
      .from("crm_contacts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating contact:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity if there were significant changes
    if (changes.length > 0) {
      await supabase.from("crm_activities").insert({
        contact_id: id,
        client_id: currentContact.client_id,
        activity_type: "note",
        subject: "Contact updated",
        body: changes.join("\n"),
        performed_by: authResult.admin!.id,
        performed_by_name: authResult.admin!.name || authResult.admin!.email,
      });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "crm_contact_updated",
      resource_type: "crm_contact",
      resource_id: id,
      details: { changes, updateData },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error in contact PATCH:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/crm/contacts/[id]
 * Delete a CRM contact (soft delete by default)
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

    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("hard") === "true";

    const supabase = await createClient();

    // Get contact for audit log
    const { data: contact, error: fetchError } = await supabase
      .from("crm_contacts")
      .select("id, client_id, email, phone, first_name, last_name")
      .eq("id", id)
      .single();

    if (fetchError || !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (hardDelete) {
      // Hard delete - remove from database
      const { error } = await supabase
        .from("crm_contacts")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting contact:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Soft delete - mark as archived
      const { error } = await supabase
        .from("crm_contacts")
        .update({ status: "archived" })
        .eq("id", id);

      if (error) {
        console.error("Error archiving contact:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: hardDelete ? "crm_contact_deleted" : "crm_contact_archived",
      resource_type: "crm_contact",
      resource_id: id,
      details: {
        email: contact.email,
        phone: contact.phone,
        name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      action: hardDelete ? "deleted" : "archived",
    });
  } catch (error) {
    console.error("Error in contact DELETE:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}

function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  } else if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return phone;
}
