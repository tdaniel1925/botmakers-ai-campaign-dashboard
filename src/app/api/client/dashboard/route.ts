import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getClientId } from "@/lib/client-auth";

/**
 * GET /api/client/dashboard
 * Get dashboard stats for the authenticated client (supports impersonation)
 */
export async function GET(request: Request) {
  try {
    // Get client ID (supports impersonation)
    const clientAuth = await getClientId(request);
    if (!clientAuth.authenticated || !clientAuth.clientId) {
      return NextResponse.json(
        { error: clientAuth.error || "Not authenticated" },
        { status: clientAuth.error === "Not authenticated" ? 401 : 403 }
      );
    }

    const clientId = clientAuth.clientId;

    // Use service client when impersonating to bypass RLS
    const supabase = clientAuth.isImpersonating
      ? await createServiceClient()
      : await createClient();

    // Fetch client info
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, company_name")
      .eq("id", clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch all campaign types
    const [legacyCampaignsRes, inboundCampaignsRes, outboundCampaignsRes] = await Promise.all([
      supabase.from("campaigns").select("id, name, is_active").eq("client_id", clientId),
      supabase.from("inbound_campaigns").select("id, name, is_active").eq("client_id", clientId),
      supabase.from("outbound_campaigns").select("id, name, status").eq("client_id", clientId),
    ]);

    const legacyCampaigns = legacyCampaignsRes.data || [];
    const inboundCampaigns = inboundCampaignsRes.data || [];
    const outboundCampaigns = outboundCampaignsRes.data || [];

    // Combine all campaigns
    const allCampaigns: { id: string; name: string; is_active: boolean; campaign_type: "legacy" | "inbound" | "outbound" }[] = [
      ...legacyCampaigns.map(c => ({ ...c, campaign_type: "legacy" as const })),
      ...inboundCampaigns.map(c => ({ ...c, campaign_type: "inbound" as const })),
      ...outboundCampaigns.map(c => ({ ...c, is_active: c.status === "active", campaign_type: "outbound" as const })),
    ];

    // Unified call structure
    interface UnifiedCall {
      id: string;
      duration_seconds: number;
      sentiment: string | null;
      outcome_tag: { tag_name: string; tag_color: string } | null;
      created_at: string;
      campaign_id: string;
      campaign_type: "legacy" | "inbound" | "outbound";
    }

    const calls: UnifiedCall[] = [];

    // Fetch legacy calls
    if (legacyCampaigns.length > 0) {
      const legacyIds = legacyCampaigns.map(c => c.id);
      const { data: legacyCalls } = await supabase
        .from("calls")
        .select(`
          id,
          call_duration,
          ai_sentiment,
          created_at,
          campaign_id,
          campaign_outcome_tags (
            tag_name,
            tag_color
          )
        `)
        .in("campaign_id", legacyIds)
        .eq("status", "completed");

      if (legacyCalls) {
        for (const call of legacyCalls) {
          const tags = call.campaign_outcome_tags as unknown as Array<{ tag_name: string; tag_color: string }>;
          calls.push({
            id: call.id,
            duration_seconds: call.call_duration || 0,
            sentiment: call.ai_sentiment,
            outcome_tag: tags?.[0] || null,
            created_at: call.created_at,
            campaign_id: call.campaign_id,
            campaign_type: "legacy",
          });
        }
      }
    }

    // Fetch inbound calls
    if (inboundCampaigns.length > 0) {
      const inboundIds = inboundCampaigns.map(c => c.id);
      const { data: inboundCalls } = await supabase
        .from("inbound_campaign_calls")
        .select(`
          id,
          duration_seconds,
          sentiment,
          created_at,
          campaign_id,
          inbound_campaign_outcome_tags (
            tag_name,
            tag_color
          )
        `)
        .in("campaign_id", inboundIds)
        .eq("status", "completed");

      if (inboundCalls) {
        for (const call of inboundCalls) {
          const tags = call.inbound_campaign_outcome_tags as unknown as Array<{ tag_name: string; tag_color: string }>;
          calls.push({
            id: call.id,
            duration_seconds: call.duration_seconds || 0,
            sentiment: call.sentiment,
            outcome_tag: tags?.[0] || null,
            created_at: call.created_at,
            campaign_id: call.campaign_id,
            campaign_type: "inbound",
          });
        }
      }
    }

    // Fetch outbound calls
    if (outboundCampaigns.length > 0) {
      const outboundIds = outboundCampaigns.map(c => c.id);
      const { data: outboundCalls } = await supabase
        .from("campaign_calls")
        .select(`
          id,
          duration_seconds,
          outcome,
          created_at,
          campaign_id
        `)
        .in("campaign_id", outboundIds)
        .eq("status", "completed");

      if (outboundCalls) {
        for (const call of outboundCalls) {
          // Map outcome to sentiment for outbound
          let sentiment: string | null = null;
          if (call.outcome === "positive") sentiment = "positive";
          else if (call.outcome === "negative") sentiment = "negative";
          else if (call.outcome) sentiment = "neutral";

          calls.push({
            id: call.id,
            duration_seconds: call.duration_seconds || 0,
            sentiment,
            outcome_tag: null,
            created_at: call.created_at,
            campaign_id: call.campaign_id,
            campaign_type: "outbound",
          });
        }
      }
    }

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCalls = calls.filter(
      (c) => new Date(c.created_at) >= today
    ).length;

    const avgDuration =
      calls.length > 0
        ? Math.round(
            calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) /
              calls.length
          )
        : 0;

    const positiveCalls = calls.filter(
      (c) => c.sentiment === "positive"
    ).length;
    const negativeCalls = calls.filter(
      (c) => c.sentiment === "negative"
    ).length;
    const neutralCalls = calls.filter(
      (c) => c.sentiment === "neutral"
    ).length;

    const outcomeCounts: Record<string, { count: number; color: string }> = {};
    calls.forEach((call) => {
      const tagName = call.outcome_tag?.tag_name || "Unknown";
      const tagColor = call.outcome_tag?.tag_color || "#94a3b8";
      if (!outcomeCounts[tagName]) {
        outcomeCounts[tagName] = { count: 0, color: tagColor };
      }
      outcomeCounts[tagName].count++;
    });

    const outcomeBreakdown = Object.entries(outcomeCounts)
      .map(([name, { count, color }]) => ({
        name,
        value: count,
        color,
      }))
      .sort((a, b) => b.value - a.value);

    // Calculate campaign stats
    const recentCampaigns = allCampaigns.slice(0, 5).map((campaign) => {
      const campaignCalls = calls.filter((c) => c.campaign_id === campaign.id && c.campaign_type === campaign.campaign_type);
      const positiveCampaignCalls = campaignCalls.filter(
        (c) => c.sentiment === "positive"
      ).length;
      return {
        id: campaign.id,
        name: campaign.name,
        is_active: campaign.is_active,
        call_count: campaignCalls.length,
        positive_rate: campaignCalls.length > 0
          ? Math.round((positiveCampaignCalls / campaignCalls.length) * 100)
          : 0,
        campaign_type: campaign.campaign_type,
      };
    });

    // Weekly data (last 7 days)
    const weeklyData: { day: string; calls: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      const dayCalls = calls.filter((c) => {
        const callDate = new Date(c.created_at);
        return callDate >= date && callDate < nextDay;
      }).length;

      weeklyData.push({ day: dayName, calls: dayCalls });
    }

    return NextResponse.json({
      clientInfo: {
        name: client.name,
        companyName: client.company_name,
      },
      stats: {
        totalCalls: calls.length,
        todayCalls,
        avgDuration,
        positiveCalls,
        negativeCalls,
        neutralCalls,
        outcomeBreakdown,
        recentCampaigns,
        weeklyData,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
