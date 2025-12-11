import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

// Get queue status
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; queueId: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { queueId } = await params;
    const supabase = await createClient();

    const { data: queueEntry, error } = await supabase
      .from("contact_upload_queue")
      .select("*")
      .eq("id", queueId)
      .single();

    if (error || !queueEntry) {
      return NextResponse.json(
        { error: "Queue entry not found" },
        { status: 404 }
      );
    }

    // Calculate progress percentage
    const progress = queueEntry.total_contacts > 0
      ? Math.round((queueEntry.processed_contacts / queueEntry.total_contacts) * 100)
      : 0;

    return NextResponse.json({
      ...queueEntry,
      progress,
      pending_data: undefined, // Don't send back all the data
    });
  } catch (error) {
    console.error("Get queue status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch queue status" },
      { status: 500 }
    );
  }
}

// Process next chunk
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; queueId: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { queueId } = await params;
    const serviceClient = await createServiceClient();

    // Process the next chunk
    const { data: processResult, error: processError } = await serviceClient
      .rpc("process_contact_upload_chunk", { queue_id: queueId });

    if (processError) {
      console.error("Processing error:", processError);
      return NextResponse.json(
        { error: "Failed to process chunk", details: processError.message },
        { status: 500 }
      );
    }

    // Get updated queue status
    const { data: queueEntry, error: fetchError } = await serviceClient
      .from("contact_upload_queue")
      .select("*")
      .eq("id", queueId)
      .single();

    if (fetchError) {
      return NextResponse.json({
        success: true,
        result: processResult,
      });
    }

    const progress = queueEntry.total_contacts > 0
      ? Math.round((queueEntry.processed_contacts / queueEntry.total_contacts) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      result: processResult,
      queue: {
        ...queueEntry,
        progress,
        pending_data: undefined,
      },
    });
  } catch (error) {
    console.error("Process chunk error:", error);
    return NextResponse.json(
      { error: "Failed to process chunk" },
      { status: 500 }
    );
  }
}

// Cancel upload
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; queueId: string }> }
) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const { queueId } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("contact_upload_queue")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", queueId)
      .in("status", ["pending", "processing"]);

    if (error) {
      return NextResponse.json(
        { error: "Failed to cancel upload" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Upload cancelled",
    });
  } catch (error) {
    console.error("Cancel upload error:", error);
    return NextResponse.json(
      { error: "Failed to cancel upload" },
      { status: 500 }
    );
  }
}
