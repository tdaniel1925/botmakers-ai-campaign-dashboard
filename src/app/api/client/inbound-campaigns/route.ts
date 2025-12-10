import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getClientId } from "@/lib/client-auth";

/**
 * GET /api/client/inbound-campaigns
 * Get all inbound campaigns for the authenticated client
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get client ID (supports impersonation)
    const clientAuth = await getClientId(request);
    if (!clientAuth.authenticated || !clientAuth.clientId) {
      return NextResponse.json(
        { error: clientAuth.error || "Not authenticated" },
        { status: clientAuth.error === "Not authenticated" ? 401 : 403 }
      );
    }

    const clientId = clientAuth.clientId;

    // Fetch inbound campaigns with call stats
    const { data: campaigns, error } = await supabase
      .from("inbound_campaigns")
      .select(`
        id,
        name,
        description,
        is_active,
        created_at,
        inbound_campaign_calls (
          id,
          status,
          ai_sentiment,
          created_at
        )
      `)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching inbound campaigns:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process campaigns with stats
    interface CallRecord {
      id: string;
      status: string;
      ai_sentiment: string | null;
      created_at: string;
    }

    const processedCampaigns = (campaigns || []).map((campaign) => {
      const calls = (campaign.inbound_campaign_calls || []) as unknown as CallRecord[];
      const completedCalls = calls.filter(c => c.status === "completed");
      const positiveCalls = completedCalls.filter(c => c.ai_sentiment === "positive");
      const lastCall = calls.length > 0
        ? calls.reduce((latest, call) =>
            new Date(call.created_at) > new Date(latest.created_at) ? call : latest
          )
        : null;

      return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        is_active: campaign.is_active,
        created_at: campaign.created_at,
        stats: {
          totalCalls: calls.length,
          completedCalls: completedCalls.length,
          positiveCalls: positiveCalls.length,
          positiveRate: completedCalls.length > 0
            ? Math.round((positiveCalls.length / completedCalls.length) * 100)
            : 0,
        },
        last_call_at: lastCall?.created_at || null,
      };
    });

    return NextResponse.json({ campaigns: processedCampaigns });
  } catch (error) {
    console.error("Error in client inbound campaigns GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
