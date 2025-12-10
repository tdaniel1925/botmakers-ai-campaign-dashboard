import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getClientId } from "@/lib/client-auth";

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

    // Get client ID (supports impersonation)
    const clientAuth = await getClientId(request);
    if (!clientAuth.authenticated || !clientAuth.clientId) {
      return NextResponse.json(
        { error: clientAuth.error || "Not authenticated" },
        { status: clientAuth.error === "Not authenticated" ? 401 : 403 }
      );
    }

    const clientId = clientAuth.clientId;

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
        .eq("client_id", clientId);

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
        .eq("client_id", clientId);

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
            ai_sentiment,
            duration_seconds,
            transcript,
            audio_url,
            ai_summary,
            created_at,
            inbound_campaign_outcome_tags (
              tag_name,
              tag_color
            )
          `, { count: "exact" })
          .in("campaign_id", campaignIds)
          .order("created_at", { ascending: false });

        if (sentiment && sentiment !== "all") {
          inboundQuery = inboundQuery.eq("ai_sentiment", sentiment);
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
              sentiment: call.ai_sentiment,
              duration_seconds: call.duration_seconds || 0,
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

    // Fetch Outbound Campaign Calls
    if (fetchTypes.includes("outbound")) {
      // First get the client's outbound campaigns
      const { data: outboundCampaigns } = await supabase
        .from("outbound_campaigns")
        .select("id, name")
        .eq("client_id", clientId);

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

        const { data: outboundCalls, error: outboundError } = await outboundQuery;

        if (outboundError) {
          console.error("Error fetching outbound calls:", outboundError);
        } else if (outboundCalls) {
          // Process outbound calls and count after filtering
          let outboundFilteredCount = 0;
          for (const call of outboundCalls) {
            // Contacts come as arrays from the join
            const contacts = call.campaign_contacts as unknown as Array<{ phone_number: string }>;
            const contact = contacts?.[0];
            // Map outcome to sentiment for consistency
            let callSentiment: string | null = null;
            if (call.outcome === "positive") callSentiment = "positive";
            else if (call.outcome === "negative") callSentiment = "negative";

            // Apply sentiment filter for outbound calls - skip if doesn't match
            if (sentiment && sentiment !== "all" && callSentiment !== sentiment) {
              continue;
            }

            outboundFilteredCount++;
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
          totalCount += outboundFilteredCount;
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
