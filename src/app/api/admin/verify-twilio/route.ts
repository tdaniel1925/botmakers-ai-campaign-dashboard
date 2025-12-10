import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { verifyTwilioConnection } from "@/lib/sms/twilio";

/**
 * GET /api/admin/verify-twilio
 * Verify Twilio connection and return account status (admin only)
 */
export async function GET() {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const result = await verifyTwilioConnection();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error verifying Twilio connection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to verify Twilio connection",
      },
      { status: 500 }
    );
  }
}
