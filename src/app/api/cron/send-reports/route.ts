import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/emails";

// This route is designed to be called by Vercel Cron or an external scheduler
// Configure in vercel.json with: "crons": [{ "path": "/api/cron/send-reports", "schedule": "0 * * * *" }]

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay(); // 0 = Sunday

  try {
    // Get all active clients with their report preferences
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select(`
        id,
        email,
        name,
        report_frequency,
        report_day_of_week,
        report_hour,
        last_report_sent_at
      `)
      .eq("is_active", true)
      .neq("report_frequency", "none");

    if (clientsError) throw clientsError;

    const reportsSent: string[] = [];
    const errors: string[] = [];

    for (const client of clients || []) {
      try {
        // Check if it's time to send this client's report
        if (!shouldSendReport(client, currentHour, currentDay)) {
          continue;
        }

        // Get client's campaigns
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id, name")
          .eq("client_id", client.id)
          .eq("is_active", true);

        if (!campaigns || campaigns.length === 0) continue;

        const campaignIds = campaigns.map((c) => c.id);

        // Calculate report period based on frequency
        const periodStart = getReportPeriodStart(client.report_frequency, now);

        // Get call stats for the period
        const { data: calls, error: callsError } = await supabase
          .from("calls")
          .select("id, ai_sentiment, call_duration, created_at")
          .in("campaign_id", campaignIds)
          .eq("status", "completed")
          .gte("created_at", periodStart.toISOString());

        if (callsError) throw callsError;

        // Calculate stats
        const totalCalls = calls?.length || 0;
        const positiveCalls = calls?.filter((c) => c.ai_sentiment === "positive").length || 0;
        const negativeCalls = calls?.filter((c) => c.ai_sentiment === "negative").length || 0;
        const totalDuration = calls?.reduce((sum, c) => sum + (c.call_duration || 0), 0) || 0;
        const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
        const positiveRate = totalCalls > 0 ? Math.round((positiveCalls / totalCalls) * 100) : 0;

        // Format period for email
        const periodLabel = formatPeriodLabel(client.report_frequency);

        // Send report email
        await sendEmail({
          to: client.email,
          templateSlug: "campaign_report",
          data: {
            clientName: client.name,
            periodLabel,
            totalCalls,
            positiveCalls,
            negativeCalls,
            positiveRate,
            avgDuration: formatDuration(avgDuration),
            campaignCount: campaigns.length,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://botmakers.agency"}/dashboard`,
          },
          clientId: client.id,
        });

        // Update last report sent timestamp
        await supabase
          .from("clients")
          .update({ last_report_sent_at: now.toISOString() })
          .eq("id", client.id);

        reportsSent.push(client.email);
      } catch (error) {
        console.error(`Error sending report to ${client.email}:`, error);
        errors.push(`${client.email}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({
      success: true,
      reportsSent: reportsSent.length,
      recipients: reportsSent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Error in cron job:", error);
    return NextResponse.json(
      { error: "Failed to process reports", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function shouldSendReport(
  client: {
    report_frequency: string;
    report_day_of_week: number;
    report_hour: number;
    last_report_sent_at: string | null;
  },
  currentHour: number,
  currentDay: number
): boolean {
  // Check if it's the right hour
  if (client.report_hour !== currentHour) return false;

  // Check frequency-specific conditions
  switch (client.report_frequency) {
    case "daily":
      return true;

    case "weekly":
      // Check if it's the right day of the week
      return client.report_day_of_week === currentDay;

    case "monthly":
      // Send on the first day of the month
      const today = new Date();
      return today.getUTCDate() === 1;

    default:
      return false;
  }
}

function getReportPeriodStart(frequency: string, now: Date): Date {
  const start = new Date(now);

  switch (frequency) {
    case "daily":
      start.setUTCDate(start.getUTCDate() - 1);
      break;
    case "weekly":
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case "monthly":
      start.setUTCMonth(start.getUTCMonth() - 1);
      break;
  }

  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function formatPeriodLabel(frequency: string): string {
  switch (frequency) {
    case "daily":
      return "Daily Report";
    case "weekly":
      return "Weekly Report";
    case "monthly":
      return "Monthly Report";
    default:
      return "Report";
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
