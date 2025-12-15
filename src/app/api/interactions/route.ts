import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { interactions, campaigns, organizations } from '@/db/schema';
import { eq, and, or, ilike, gte, lte, desc, inArray, sql } from 'drizzle-orm';
import { requireFullAuth } from '@/lib/auth';

// GET /api/interactions - List interactions
export async function GET(request: NextRequest) {
  try {
    const user = await requireFullAuth();
    const searchParams = request.nextUrl.searchParams;

    // Filters
    const search = searchParams.get('search');
    const campaignId = searchParams.get('campaignId');
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status');
    const sourceType = searchParams.get('sourceType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const flaggedOnly = searchParams.get('flaggedOnly') === 'true';

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // For client users, only show their organization's interactions
    let allowedCampaignIds: string[] = [];

    if (user.role === 'client_user') {
      if (!user.organizationId) {
        return NextResponse.json({ data: [], total: 0, page, limit });
      }
      // Get campaigns for this organization
      const orgCampaigns = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.organizationId, user.organizationId));
      allowedCampaignIds = orgCampaigns.map(c => c.id);

      if (allowedCampaignIds.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, limit });
      }
    } else if (organizationId) {
      // Admin filtering by organization
      const orgCampaigns = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.organizationId, organizationId));
      allowedCampaignIds = orgCampaigns.map(c => c.id);
    }

    // Build where conditions
    const conditions = [];

    // Campaign filter (either from org restriction or explicit filter)
    if (campaignId) {
      // Verify access if client user
      if (user.role === 'client_user' && !allowedCampaignIds.includes(campaignId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      conditions.push(eq(interactions.campaignId, campaignId));
    } else if (allowedCampaignIds.length > 0) {
      conditions.push(inArray(interactions.campaignId, allowedCampaignIds));
    }

    // Other filters
    if (search) {
      conditions.push(
        or(
          ilike(interactions.phoneNumber, `%${search}%`),
          ilike(interactions.aiSummary, `%${search}%`),
          ilike(interactions.transcript, `%${search}%`)
        )
      );
    }
    if (status) {
      conditions.push(eq(interactions.callStatus, status as any));
    }
    if (sourceType) {
      conditions.push(eq(interactions.sourceType, sourceType as any));
    }
    if (startDate) {
      conditions.push(gte(interactions.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(interactions.createdAt, end));
    }
    if (flaggedOnly) {
      conditions.push(eq(interactions.flagged, true));
    }

    // Execute query
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.query.interactions.findMany({
        where: whereClause,
        with: {
          campaign: {
            with: {
              organization: true,
            },
          },
        },
        orderBy: [desc(interactions.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` })
        .from(interactions)
        .where(whereClause),
    ]);

    return NextResponse.json({
      data,
      total: Number(countResult[0]?.count || 0),
      page,
      limit,
    });
  } catch (error) {
    console.error('[Interactions API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch interactions' },
      { status: 500 }
    );
  }
}
