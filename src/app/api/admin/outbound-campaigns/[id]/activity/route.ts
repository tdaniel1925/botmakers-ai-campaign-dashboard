import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

/**
 * GET /api/admin/outbound-campaigns/[id]/activity
 * Get activity report/analytics for a campaign (admin version)
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

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Parse query params for date range
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Get all calls for this campaign
    let callsQuery = supabase
      .from("campaign_calls")
      .select("*")
      .eq("campaign_id", id);

    if (startDate) {
      callsQuery = callsQuery.gte("created_at", startDate);
    }
    if (endDate) {
      callsQuery = callsQuery.lte("created_at", endDate);
    }

    const { data: calls } = await callsQuery;

    // Get SMS stats
    let smsQuery = supabase
      .from("campaign_sms")
      .select("*")
      .eq("campaign_id", id);

    if (startDate) {
      smsQuery = smsQuery.gte("created_at", startDate);
    }
    if (endDate) {
      smsQuery = smsQuery.lte("created_at", endDate);
    }

    const { data: smsMessages } = await smsQuery;

    // Calculate summary metrics
    const allCalls = calls || [];
    const allSms = smsMessages || [];

    const totalCalls = allCalls.length;
    const answeredCalls = allCalls.filter(
      (c) => c.status === "answered" || c.outcome !== null
    ).length;
    const unansweredCalls = totalCalls - answeredCalls;
    const positiveCalls = allCalls.filter((c) => c.outcome === "positive").length;
    const negativeCalls = allCalls.filter((c) => c.outcome === "negative").length;

    const totalDurationSeconds = allCalls.reduce(
      (sum, c) => sum + (c.duration_seconds || 0),
      0
    );
    const totalMinutes = totalDurationSeconds / 60;
    const totalCost = allCalls.reduce((sum, c) => sum + parseFloat(c.cost || "0"), 0);

    const avgCallDuration =
      answeredCalls > 0 ? totalDurationSeconds / answeredCalls : 0;

    const totalSms = allSms.length;
    const deliveredSms = allSms.filter((s) => s.status === "delivered").length;
    const smsDeliveryRate = totalSms > 0 ? (deliveredSms / totalSms) * 100 : 0;

    // Group calls by date for trends
    const callsByDate: Record<string, number> = {};
    const outcomesByDate: Record<string, { positive: number; negative: number }> = {};

    for (const call of allCalls) {
      const date = new Date(call.created_at).toISOString().split("T")[0];
      callsByDate[date] = (callsByDate[date] || 0) + 1;

      if (!outcomesByDate[date]) {
        outcomesByDate[date] = { positive: 0, negative: 0 };
      }
      if (call.outcome === "positive") {
        outcomesByDate[date].positive++;
      } else if (call.outcome === "negative") {
        outcomesByDate[date].negative++;
      }
    }

    // Group calls by hour for hourly distribution
    const callsByHour: Record<number, number> = {};
    for (const call of allCalls) {
      const hour = new Date(call.created_at).getHours();
      callsByHour[hour] = (callsByHour[hour] || 0) + 1;
    }

    // Outcome distribution for pie chart
    const outcomeDistribution = [
      { name: "Positive", value: positiveCalls, color: "#22c55e" },
      { name: "Negative", value: negativeCalls, color: "#ef4444" },
      { name: "No Answer", value: unansweredCalls, color: "#6b7280" },
    ].filter((o) => o.value > 0);

    return NextResponse.json({
      summary: {
        totalCalls,
        answeredCalls,
        unansweredCalls,
        positiveCalls,
        negativeCalls,
        positiveRate: answeredCalls > 0 ? (positiveCalls / answeredCalls) * 100 : 0,
        totalMinutes: Math.round(totalMinutes * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        avgCallDuration: Math.round(avgCallDuration),
        totalSms,
        deliveredSms,
        smsDeliveryRate: Math.round(smsDeliveryRate * 100) / 100,
        contactsRemaining: campaign.total_contacts - campaign.contacts_completed,
        progress:
          campaign.total_contacts > 0
            ? Math.round(
                (campaign.contacts_completed / campaign.total_contacts) * 100
              )
            : 0,
      },
      charts: {
        callsOverTime: Object.entries(callsByDate)
          .map(([date, count]) => ({ date, calls: count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        outcomesByDate: Object.entries(outcomesByDate)
          .map(([date, outcomes]) => ({
            date,
            ...outcomes,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        callsByHour: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          calls: callsByHour[i] || 0,
        })),
        outcomeDistribution,
      },
      campaign: {
        name: campaign.name,
        status: campaign.status,
        launched_at: campaign.launched_at,
        is_test_mode: campaign.is_test_mode,
      },
    });
  } catch (error) {
    console.error("Error fetching activity report:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity report" },
      { status: 500 }
    );
  }
}
