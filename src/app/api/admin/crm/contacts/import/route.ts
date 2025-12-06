import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

interface ImportContact {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  lead_source?: string;
  tags?: string[];
  notes?: string;
  [key: string]: unknown;
}

/**
 * POST /api/admin/crm/contacts/import
 * Import contacts from CSV/JSON data
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const {
      client_id,
      contacts,
      duplicate_handling = "skip", // skip, update, create_new
      default_status = "lead",
      default_pipeline_stage = "new",
      default_tags = [],
      field_mapping = {},
    } = body;

    if (!client_id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: "Contacts array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (contacts.length > 5000) {
      return NextResponse.json(
        { error: "Maximum 5000 contacts per import" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Create import job
    const { data: importJob, error: jobError } = await supabase
      .from("crm_import_jobs")
      .insert({
        client_id,
        imported_by: authResult.admin!.id,
        source_type: "api",
        total_records: contacts.length,
        status: "processing",
        field_mapping,
      })
      .select()
      .single();

    if (jobError) {
      console.error("Error creating import job:", jobError);
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    // Process contacts in batches
    const batchSize = 100;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const rowIndex = i + j + 1;
        const rawContact = batch[j] as ImportContact;

        try {
          // Apply field mapping
          const mappedContact = applyFieldMapping(rawContact, field_mapping);

          // Validate required fields
          if (!mappedContact.email && !mappedContact.phone) {
            results.failed++;
            results.errors.push({
              row: rowIndex,
              error: "Either email or phone is required",
            });
            continue;
          }

          // Normalize phone
          const normalizedPhone = mappedContact.phone
            ? normalizePhoneNumber(mappedContact.phone)
            : null;

          // Check for existing contact
          let existingContact = null;
          if (mappedContact.email) {
            const { data } = await supabase
              .from("crm_contacts")
              .select("id")
              .eq("client_id", client_id)
              .eq("email", mappedContact.email)
              .single();
            existingContact = data;
          }

          if (!existingContact && normalizedPhone) {
            const { data } = await supabase
              .from("crm_contacts")
              .select("id")
              .eq("client_id", client_id)
              .eq("phone", normalizedPhone)
              .single();
            existingContact = data;
          }

          if (existingContact) {
            if (duplicate_handling === "skip") {
              results.skipped++;
              continue;
            } else if (duplicate_handling === "update") {
              // Update existing contact
              const { error: updateError } = await supabase
                .from("crm_contacts")
                .update({
                  first_name: mappedContact.first_name || undefined,
                  last_name: mappedContact.last_name || undefined,
                  company: mappedContact.company || undefined,
                  job_title: mappedContact.job_title || undefined,
                  notes: mappedContact.notes || undefined,
                })
                .eq("id", existingContact.id);

              if (updateError) {
                results.failed++;
                results.errors.push({
                  row: rowIndex,
                  error: updateError.message,
                });
              } else {
                results.updated++;
              }
              continue;
            }
            // create_new - continue to create
          }

          // Parse tags
          let tags = default_tags as string[];
          if (mappedContact.tags) {
            if (typeof mappedContact.tags === "string") {
              tags = [...default_tags, ...(mappedContact.tags as string).split(",").map((t: string) => t.trim())];
            } else if (Array.isArray(mappedContact.tags)) {
              tags = [...default_tags, ...(mappedContact.tags as string[])];
            }
          }

          // Create new contact
          const { error: insertError } = await supabase
            .from("crm_contacts")
            .insert({
              client_id,
              first_name: mappedContact.first_name || null,
              last_name: mappedContact.last_name || null,
              email: mappedContact.email || null,
              phone: normalizedPhone,
              company: mappedContact.company || null,
              job_title: mappedContact.job_title || null,
              lead_source: mappedContact.lead_source || "import",
              status: default_status,
              pipeline_stage: default_pipeline_stage,
              tags,
              notes: mappedContact.notes || null,
              custom_fields: extractCustomFields(mappedContact),
            });

          if (insertError) {
            results.failed++;
            results.errors.push({
              row: rowIndex,
              error: insertError.message,
            });
          } else {
            results.imported++;
          }
        } catch (err) {
          results.failed++;
          results.errors.push({
            row: rowIndex,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    // Update import job with results
    await supabase
      .from("crm_import_jobs")
      .update({
        status: results.failed === contacts.length ? "failed" : "completed",
        successful_records: results.imported + results.updated,
        failed_records: results.failed,
        skipped_records: results.skipped,
        error_details: results.errors.length > 0 ? results.errors : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", importJob.id);

    // Log audit
    await supabase.from("audit_logs").insert({
      user_id: authResult.admin!.id,
      user_type: "admin",
      user_email: authResult.admin!.email,
      action: "crm_contacts_imported",
      resource_type: "crm_import_job",
      resource_id: importJob.id,
      details: {
        client_id,
        total: contacts.length,
        ...results,
      },
    });

    return NextResponse.json({
      success: true,
      job_id: importJob.id,
      results,
    });
  } catch (error) {
    console.error("Error in contacts import:", error);
    return NextResponse.json(
      { error: "Failed to import contacts" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/crm/contacts/import
 * Get import job status and history
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("job_id");
    const clientId = searchParams.get("client_id");

    const supabase = await createClient();

    if (jobId) {
      // Get specific job
      const { data: job, error } = await supabase
        .from("crm_import_jobs")
        .select(`
          *,
          imported_by_admin:admin_users!crm_import_jobs_imported_by_fkey(id, name, email)
        `)
        .eq("id", jobId)
        .single();

      if (error) {
        return NextResponse.json({ error: "Import job not found" }, { status: 404 });
      }

      return NextResponse.json(job);
    }

    // List recent imports
    let query = supabase
      .from("crm_import_jobs")
      .select(`
        *,
        imported_by_admin:admin_users!crm_import_jobs_imported_by_fkey(id, name, email)
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error("Error fetching import jobs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (error) {
    console.error("Error in import GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch import jobs" },
      { status: 500 }
    );
  }
}

function applyFieldMapping(
  contact: ImportContact,
  mapping: Record<string, string>
): ImportContact {
  if (!mapping || Object.keys(mapping).length === 0) {
    return contact;
  }

  const mapped: ImportContact = {};
  for (const [sourceField, targetField] of Object.entries(mapping)) {
    if (contact[sourceField] !== undefined) {
      mapped[targetField] = contact[sourceField];
    }
  }

  // Copy unmapped fields
  for (const [key, value] of Object.entries(contact)) {
    if (!mapping[key]) {
      mapped[key] = value;
    }
  }

  return mapped;
}

function extractCustomFields(contact: ImportContact): Record<string, unknown> {
  const standardFields = [
    "first_name", "last_name", "email", "phone", "company",
    "job_title", "lead_source", "tags", "notes"
  ];

  const customFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(contact)) {
    if (!standardFields.includes(key) && value !== undefined) {
      customFields[key] = value;
    }
  }

  return Object.keys(customFields).length > 0 ? customFields : {};
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
