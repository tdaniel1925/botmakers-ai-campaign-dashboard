import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

interface UnifiedCall {
  id: string;
  campaign_type: "legacy" | "inbound" | "outbound";
  campaign_id: string;
  campaign_name: string;
  client_name: string;
  caller_phone: string | null;
  status: string;
  outcome: string | null;
  duration_seconds: number;
  transcript: string | null;
  audio_url: string | null;
  created_at: string;
  summary?: string | null;
}

/**
 * GET /api/admin/calls/unified
 * Get all calls from all campaign types (legacy, inbound, outbound)
 */
export async function GET(request: Request) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse();
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const campaignType = searchParams.get("campaign_type");
    const clientId = searchParams.get("client_id");
    const status = searchParams.get("status");
    const offset = (page - 1) * limit;

    const calls: UnifiedCall[] = [];
    let totalCount = 0;

    // Fetch from all three tables based on filter
    const fetchTypes = campaignType
      ? [campaignType]
      : ["legacy", "inbound", "outbound"];

    // Helper to apply common filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyFilters = <T extends { eq: (col: string, val: string) => T }>(query: T, statusCol: string): T => {
      if (status && status !== "all") {
        return query.eq(statusCol, status);
      }
      return query;
    };

    // Fetch Legacy Calls
    if (fetchTypes.includes("legacy")) {
      let legacyQuery = supabase
        .from("calls")
        .select(`
          id,
          campaign_id,
          caller_phone,
          call_status,
          ai_outcome,
          call_duration,
          transcript,
          audio_url,
          created_at,
          ai_summary,
          campaigns!inner (
            id,
            name,
            clients (
              id,
              name
            )
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (clientId) {
        legacyQuery = legacyQuery.eq("campaigns.client_id", clientId);
      }
      legacyQuery = applyFilters(legacyQuery, "call_status");

      const { data: legacyCalls, count: legacyCount, error: legacyError } = await legacyQuery;

      if (legacyError) {
        console.error("Error fetching legacy calls:", legacyError);
      } else if (legacyCalls) {
        totalCount += legacyCount || 0;
        for (const call of legacyCalls) {
          // Relations come as arrays with !inner join
          const campaigns = call.campaigns as unknown as Array<{ id: string; name: string; clients: Array<{ id: string; name: string }> }>;
          const campaign = campaigns?.[0];
          const client = campaign?.clients?.[0];
          calls.push({
            id: call.id,
            campaign_type: "legacy",
            campaign_id: call.campaign_id,
            campaign_name: campaign?.name || "Unknown",
            client_name: client?.name || "Unknown",
            caller_phone: call.caller_phone,
            status: call.call_status || "unknown",
            outcome: call.ai_outcome,
            duration_seconds: call.call_duration || 0,
            transcript: call.transcript,
            audio_url: call.audio_url,
            created_at: call.created_at,
            summary: call.ai_summary,
          });
        }
      }
    }

    // Fetch Inbound Campaign Calls
    if (fetchTypes.includes("inbound")) {
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
          inbound_campaigns!inner (
            id,
            name,
            clients (
              id,
              name
            )
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (clientId) {
        inboundQuery = inboundQuery.eq("inbound_campaigns.client_id", clientId);
      }
      inboundQuery = applyFilters(inboundQuery, "status");

      const { data: inboundCalls, count: inboundCount, error: inboundError } = await inboundQuery;

      if (inboundError) {
        console.error("Error fetching inbound calls:", inboundError);
      } else if (inboundCalls) {
        totalCount += inboundCount || 0;
        for (const call of inboundCalls) {
          // Relations come as arrays with !inner join
          const campaigns = call.inbound_campaigns as unknown as Array<{ id: string; name: string; clients: Array<{ id: string; name: string }> }>;
          const campaign = campaigns?.[0];
          const client = campaign?.clients?.[0];
          calls.push({
            id: call.id,
            campaign_type: "inbound",
            campaign_id: call.campaign_id,
            campaign_name: campaign?.name || "Unknown",
            client_name: client?.name || "Unknown",
            caller_phone: call.caller_phone,
            status: call.status || "unknown",
            outcome: call.sentiment,
            duration_seconds: call.duration_seconds || 0,
            transcript: call.transcript,
            audio_url: call.audio_url,
            created_at: call.created_at,
          });
        }
      }
    }

    // Fetch Outbound Campaign Calls
    if (fetchTypes.includes("outbound")) {
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
          created_at,
          summary,
          campaign_contacts (
            phone_number
          ),
          outbound_campaigns!inner (
            id,
            name,
            clients (
              id,
              name
            )
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (clientId) {
        outboundQuery = outboundQuery.eq("outbound_campaigns.client_id", clientId);
      }
      outboundQuery = applyFilters(outboundQuery, "status");

      const { data: outboundCalls, count: outboundCount, error: outboundError } = await outboundQuery;

      if (outboundError) {
        console.error("Error fetching outbound calls:", outboundError);
      } else if (outboundCalls) {
        totalCount += outboundCount || 0;
        for (const call of outboundCalls) {
          // Relations come as arrays with !inner join
          const campaigns = call.outbound_campaigns as unknown as Array<{ id: string; name: string; clients: Array<{ id: string; name: string }> }>;
          const campaign = campaigns?.[0];
          const client = campaign?.clients?.[0];
          const contacts = call.campaign_contacts as unknown as Array<{ phone_number: string }>;
          const contact = contacts?.[0];
          calls.push({
            id: call.id,
            campaign_type: "outbound",
            campaign_id: call.campaign_id,
            campaign_name: campaign?.name || "Unknown",
            client_name: client?.name || "Unknown",
            caller_phone: contact?.phone_number || null,
            status: call.status || "unknown",
            outcome: call.outcome,
            duration_seconds: call.duration_seconds || 0,
            transcript: call.transcript,
            audio_url: call.recording_url,
            created_at: call.created_at,
            summary: call.summary,
          });
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
    console.error("Error in unified calls GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
