import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createReportPDF } from "@/lib/pdf/report-template";
import { format, subDays } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("clientId");
    const period = searchParams.get("period") || "30d";

    // Calculate date range
    const now = new Date();
    let fromDate: Date;
    switch (period) {
      case "7d":
        fromDate = subDays(now, 7);
        break;
      case "30d":
        fromDate = subDays(now, 30);
        break;
      case "90d":
        fromDate = subDays(now, 90);
        break;
      default:
        fromDate = subDays(now, 30);
    }

    // Determine if user is admin or client
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", user.email)
      .single();

    let targetClientId = clientId;

    if (!admin) {
      // Client user - only allow their own data
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      targetClientId = client.id;
    }

    if (!targetClientId) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    // Get client info
    const { data: clientData } = await supabase
      .from("clients")
      .select("id, name, company_name")
      .eq("id", targetClientId)
      .single();

    if (!clientData) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get campaigns for this client
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("client_id", targetClientId)
      .eq("is_active", true);

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json(
        { error: "No campaigns found" },
        { status: 404 }
      );
    }

    const campaignIds = campaigns.map((c) => c.id);

    // Get calls for these campaigns
    const { data: calls } = await supabase
      .from("calls")
      .select(
        `
        id,
        campaign_id,
        call_duration,
        ai_sentiment,
        outcome_tag_id,
        campaign_outcome_tags (
          tag_name
        )
      `
      )
      .in("campaign_id", campaignIds)
      .eq("status", "completed")
      .gte("created_at", fromDate.toISOString());

    // Calculate stats
    const totalCalls = calls?.length || 0;
    const totalDuration = calls?.reduce((sum, c) => sum + (c.call_duration || 0), 0) || 0;
    const avgDurationSecs = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const avgDuration = `${Math.floor(avgDurationSecs / 60)}m ${avgDurationSecs % 60}s`;

    const positiveCalls = calls?.filter((c) => c.ai_sentiment === "positive").length || 0;
    const neutralCalls = calls?.filter((c) => c.ai_sentiment === "neutral").length || 0;
    const negativeCalls = calls?.filter((c) => c.ai_sentiment === "negative").length || 0;
    const positiveRate = totalCalls > 0 ? Math.round((positiveCalls / totalCalls) * 100) : 0;

    // Campaign breakdown
    const campaignStats = campaigns.map((campaign) => {
      const campaignCalls = calls?.filter((c) => c.campaign_id === campaign.id) || [];
      const campTotal = campaignCalls.length;
      const campDuration = campaignCalls.reduce((sum, c) => sum + (c.call_duration || 0), 0);
      const campAvgSecs = campTotal > 0 ? Math.round(campDuration / campTotal) : 0;
      const campPositive = campaignCalls.filter((c) => c.ai_sentiment === "positive").length;

      return {
        name: campaign.name,
        calls: campTotal,
        avgDuration: `${Math.floor(campAvgSecs / 60)}m ${campAvgSecs % 60}s`,
        positiveRate: campTotal > 0 ? Math.round((campPositive / campTotal) * 100) : 0,
      };
    });

    // Outcome distribution
    const outcomeMap = new Map<string, number>();
    calls?.forEach((call) => {
      if (call.campaign_outcome_tags) {
        const tag = call.campaign_outcome_tags as unknown as { tag_name: string } | { tag_name: string }[];
        const tagName = Array.isArray(tag) ? tag[0]?.tag_name : tag?.tag_name;
        if (tagName) {
          outcomeMap.set(tagName, (outcomeMap.get(tagName) || 0) + 1);
        }
      }
    });

    const topOutcomes = Array.from(outcomeMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalCalls > 0 ? Math.round((count / totalCalls) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Generate PDF
    const reportData = {
      clientName: clientData.name,
      companyName: clientData.company_name,
      reportPeriod: `${format(fromDate, "MMM d, yyyy")} - ${format(now, "MMM d, yyyy")}`,
      generatedAt: format(now, "MMM d, yyyy 'at' h:mm a"),
      stats: {
        totalCalls,
        avgDuration,
        positiveRate,
        totalCampaigns: campaigns.length,
      },
      sentiment: {
        positive: positiveCalls,
        neutral: neutralCalls,
        negative: negativeCalls,
      },
      campaigns: campaignStats,
      topOutcomes,
    };

    const pdfBuffer = await renderToBuffer(createReportPDF(reportData));

    // Return PDF
    const filename = `campaign-report-${format(now, "yyyy-MM-dd")}.pdf`;

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating PDF report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
