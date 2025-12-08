import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface UnifiedCall {
  id: string;
  campaign_type: "legacy" | "inbound" | "outbound";
  campaign_id: string;
  campaign_name: string;
  caller_phone: string | null;
  status: string;
  outcome: string | null;
  sentiment: string | null;
  duration_seconds: number;
  transcript: string | null;
  audio_url: string | null;
  summary: string | null;
  created_at: string;
  outcome_tag?: {
    tag_name: string;
    tag_color: string;
  } | null;
}

/**
 * GET /api/client/calls
 * Get all calls from all campaign types for the authenticated client
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get client record
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const campaignType = searchParams.get("campaign_type");
    const sentiment = searchParams.get("sentiment");
    const search = searchParams.get("search");
    const offset = (page - 1) * limit;

    const calls: UnifiedCall[] = [];
    let totalCount = 0;

    // Fetch from all three tables based on filter
    const fetchTypes = campaignType && campaignType !== "all"
      ? [campaignType]
      : ["legacy", "inbound", "outbound"];

    // Fetch Legacy Calls
    if (fetchTypes.includes("legacy")) {
      // First get the client's legacy campaigns
      const { data: legacyCampaigns } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("client_id", client.id);

      if (legacyCampaigns && legacyCampaigns.length > 0) {
        const campaignIds = legacyCampaigns.map(c => c.id);
        const campaignMap = new Map(legacyCampaigns.map(c => [c.id, c.name]));

        let legacyQuery = supabase
          .from("calls")
          .select(`
            id,
            campaign_id,
            caller_phone,
            call_status,
            ai_outcome,
            ai_sentiment,
            call_duration,
            transcript,
            audio_url,
            ai_summary,
            created_at,
            campaign_outcome_tags (
              tag_name,
              tag_color
            )
          `, { count: "exact" })
          .in("campaign_id", campaignIds)
          .in("status", ["completed", "processing"])
          .order("created_at", { ascending: false });

        if (sentiment && sentiment !== "all") {
          legacyQuery = legacyQuery.eq("ai_sentiment", sentiment);
        }

        if (search) {
          legacyQuery = legacyQuery.or(
            `transcript.ilike.%${search}%,caller_phone.ilike.%${search}%`
          );
        }

        const { data: legacyCalls, count: legacyCount, error: legacyError } = await legacyQuery;

        if (legacyError) {
          console.error("Error fetching legacy calls:", legacyError);
        } else if (legacyCalls) {
          totalCount += legacyCount || 0;
          for (const call of legacyCalls) {
            // Outcome tags come as arrays from the join
            const tags = call.campaign_outcome_tags as unknown as Array<{ tag_name: string; tag_color: string }>;
            const outcomeTag = tags?.[0] || null;
            calls.push({
              id: call.id,
              campaign_type: "legacy",
              campaign_id: call.campaign_id,
              campaign_name: campaignMap.get(call.campaign_id) || "Unknown",
              caller_phone: call.caller_phone,
              status: call.call_status || "unknown",
              outcome: call.ai_outcome,
              sentiment: call.ai_sentiment,
              duration_seconds: call.call_duration || 0,
              transcript: call.transcript,
              audio_url: call.audio_url,
              summary: call.ai_summary,
              created_at: call.created_at,
              outcome_tag: outcomeTag,
            });
          }
        }
      }
    }

    // Fetch Inbound Campaign Calls
    if (fetchTypes.includes("inbound")) {
      // First get the client's inbound campaigns
      const { data: inboundCampaigns } = await supabase
        .from("inbound_campaigns")
        .select("id, name")
        .eq("client_id", client.id);

      if (inboundCampaigns && inboundCampaigns.length > 0) {
        const campaignIds = inboundCampaigns.map(c => c.id);
        const campaignMap = new Map(inboundCampaigns.map(c => [c.id, c.name]));

        let inboundQuery = supabase
          .from("inbound_campaign_calls")
          .select(`
            id,
            campaign_id,
            caller_phone,
            status,
            sentiment,
            duration_seconds,
            transcript,
            audio_url,
            created_at,
            inbound_campaign_outcome_tags (
              tag_name,
              tag_color
            )
          `, { count: "exact" })
          .in("campaign_id", campaignIds)
          .order("created_at", { ascending: false });

        if (sentiment && sentiment !== "all") {
          inboundQuery = inboundQuery.eq("sentiment", sentiment);
        }

        if (search) {
          inboundQuery = inboundQuery.or(
            `transcript.ilike.%${search}%,caller_phone.ilike.%${search}%`
          );
        }

        const { data: inboundCalls, count: inboundCount, error: inboundError } = await inboundQuery;

        if (inboundError) {
          console.error("Error fetching inbound calls:", inboundError);
        } else if (inboundCalls) {
          totalCount += inboundCount || 0;
          for (const call of inboundCalls) {
            // Outcome tags come as arrays from the join
            const tags = call.inbound_campaign_outcome_tags as unknown as Array<{ tag_name: string; tag_color: string }>;
            const outcomeTag = tags?.[0] || null;
            calls.push({
              id: call.id,
              campaign_type: "inbound",
              campaign_id: call.campaign_id,
              campaign_name: campaignMap.get(call.campaign_id) || "Unknown",
              caller_phone: call.caller_phone,
              status: call.status || "unknown",
              outcome: null,
              sentiment: call.sentiment,
              duration_seconds: call.duration_seconds || 0,
              transcript: call.transcript,
              audio_url: call.audio_url,
              summary: null,
              created_at: call.created_at,
              outcome_tag: outcomeTag,
            });
          }
        }
      }
    }

    // Fetch Outbound Campaign Calls
    if (fetchTypes.includes("outbound")) {
      // First get the client's outbound campaigns
      const { data: outboundCampaigns } = await supabase
        .from("outbound_campaigns")
        .select("id, name")
        .eq("client_id", client.id);

      if (outboundCampaigns && outboundCampaigns.length > 0) {
        const campaignIds = outboundCampaigns.map(c => c.id);
        const campaignMap = new Map(outboundCampaigns.map(c => [c.id, c.name]));

        let outboundQuery = supabase
          .from("campaign_calls")
          .select(`
            id,
            campaign_id,
            status,
            outcome,
            duration_seconds,
            transcript,
            recording_url,
            summary,
            created_at,
            campaign_contacts (
              phone_number
            )
          `, { count: "exact" })
          .in("campaign_id", campaignIds)
          .order("created_at", { ascending: false });

        if (search) {
          outboundQuery = outboundQuery.ilike("transcript", `%${search}%`);
        }

        const { data: outboundCalls, count: outboundCount, error: outboundError } = await outboundQuery;

        if (outboundError) {
          console.error("Error fetching outbound calls:", outboundError);
        } else if (outboundCalls) {
          totalCount += outboundCount || 0;
          for (const call of outboundCalls) {
            // Contacts come as arrays from the join
            const contacts = call.campaign_contacts as unknown as Array<{ phone_number: string }>;
            const contact = contacts?.[0];
            // Map outcome to sentiment for consistency
            let callSentiment: string | null = null;
            if (call.outcome === "positive") callSentiment = "positive";
            else if (call.outcome === "negative") callSentiment = "negative";

            // Apply sentiment filter for outbound calls
            if (sentiment && sentiment !== "all" && callSentiment !== sentiment) {
              continue;
            }

            calls.push({
              id: call.id,
              campaign_type: "outbound",
              campaign_id: call.campaign_id,
              campaign_name: campaignMap.get(call.campaign_id) || "Unknown",
              caller_phone: contact?.phone_number || null,
              status: call.status || "unknown",
              outcome: call.outcome,
              sentiment: callSentiment,
              duration_seconds: call.duration_seconds || 0,
              transcript: call.transcript,
              audio_url: call.recording_url,
              summary: call.summary,
              created_at: call.created_at,
              outcome_tag: null,
            });
          }
        }
      }
    }

    // Sort all calls by created_at descending
    calls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply pagination to combined results
    const paginatedCalls = calls.slice(offset, offset + limit);

    return NextResponse.json({
      calls: paginatedCalls,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error("Error in client calls GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
