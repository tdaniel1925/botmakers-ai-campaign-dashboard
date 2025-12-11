import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

interface Contact {
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  timezone?: string;
  [key: string]: string | undefined;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id: campaignId } = await params;
    const { contacts, fileName } = await request.json() as {
      contacts: Contact[];
      fileName?: string;
    };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: "No contacts provided" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, name")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Create upload queue entry
    const { data: queueEntry, error: queueError } = await supabase
      .from("contact_upload_queue")
      .insert({
        campaign_id: campaignId,
        file_name: fileName || "uploaded_contacts.csv",
        total_contacts: contacts.length,
        pending_data: contacts,
        status: "pending",
      })
      .select()
      .single();

    if (queueError) {
      console.error("Queue creation error:", queueError);
      return NextResponse.json(
        { error: "Failed to queue upload" },
        { status: 500 }
      );
    }

    // Start processing the first chunk immediately
    const serviceClient = await createServiceClient();
    const { data: processResult, error: processError } = await serviceClient
      .rpc("process_contact_upload_chunk", { queue_id: queueEntry.id });

    if (processError) {
      console.error("Initial processing error:", processError);
    }

    return NextResponse.json({
      success: true,
      queue_id: queueEntry.id,
      total_contacts: contacts.length,
      status: "processing",
      message: "Upload queued for background processing",
      initial_result: processResult,
    });
  } catch (error) {
    console.error("Queue upload error:", error);
    return NextResponse.json(
      { error: "Failed to queue upload" },
      { status: 500 }
    );
  }
}

// Get upload queue status
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { id: campaignId } = await params;
    const supabase = await createClient();

    // Get all upload queue entries for this campaign
    const { data: queueEntries, error } = await supabase
      .from("contact_upload_queue")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch upload queue" },
        { status: 500 }
      );
    }

    // Get the most recent active upload
    const activeUpload = queueEntries?.find(
      (e) => e.status === "pending" || e.status === "processing"
    );

    return NextResponse.json({
      active_upload: activeUpload || null,
      all_uploads: queueEntries || [],
    });
  } catch (error) {
    console.error("Get queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch upload queue" },
      { status: 500 }
    );
  }
}
