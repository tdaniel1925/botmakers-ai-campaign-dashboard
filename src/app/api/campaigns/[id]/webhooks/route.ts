import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, interactions, webhookErrorLogs } from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { requireFullAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/campaigns/[id]/webhooks - Get webhook logs for a campaign
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireFullAuth();
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const type = searchParams.get('type') || 'all'; // 'all', 'success', 'error'

    // Get campaign
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, id),
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check access for client users
    if (user.role === 'client_user' && campaign.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (type === 'error') {
      // Get only error logs
      const [errors, countResult] = await Promise.all([
        db
          .select()
          .from(webhookErrorLogs)
          .where(eq(webhookErrorLogs.campaignId, id))
          .orderBy(desc(webhookErrorLogs.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(webhookErrorLogs)
          .where(eq(webhookErrorLogs.campaignId, id)),
      ]);

      return NextResponse.json({
        data: errors.map(e => ({
          id: e.id,
          type: 'error',
          errorType: e.errorType,
          errorMessage: e.errorMessage,
          rawPayload: e.rawBody ? tryParseJson(e.rawBody) : null,
          createdAt: e.createdAt,
        })),
        total: Number(countResult[0]?.count || 0),
        page,
        limit,
      });
    }

    if (type === 'success') {
      // Get only successful interactions (webhooks that were processed)
      const [successLogs, countResult] = await Promise.all([
        db
          .select({
            id: interactions.id,
            interactionNumber: interactions.interactionNumber,
            sourceType: interactions.sourceType,
            sourcePlatform: interactions.sourcePlatform,
            phoneNumber: interactions.phoneNumber,
            callStatus: interactions.callStatus,
            rawPayload: interactions.rawPayload,
            createdAt: interactions.createdAt,
          })
          .from(interactions)
          .where(eq(interactions.campaignId, id))
          .orderBy(desc(interactions.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(interactions)
          .where(eq(interactions.campaignId, id)),
      ]);

      return NextResponse.json({
        data: successLogs.map(i => ({
          id: i.id,
          type: 'success',
          interactionNumber: i.interactionNumber,
          sourceType: i.sourceType,
          sourcePlatform: i.sourcePlatform,
          phoneNumber: i.phoneNumber,
          callStatus: i.callStatus,
          rawPayload: i.rawPayload,
          createdAt: i.createdAt,
        })),
        total: Number(countResult[0]?.count || 0),
        page,
        limit,
      });
    }

    // Get all webhooks (both successful and errors) - combined and sorted
    const [successLogs, errorLogs, successCount, errorCount] = await Promise.all([
      db
        .select({
          id: interactions.id,
          interactionNumber: interactions.interactionNumber,
          sourceType: interactions.sourceType,
          sourcePlatform: interactions.sourcePlatform,
          phoneNumber: interactions.phoneNumber,
          callStatus: interactions.callStatus,
          rawPayload: interactions.rawPayload,
          createdAt: interactions.createdAt,
        })
        .from(interactions)
        .where(eq(interactions.campaignId, id))
        .orderBy(desc(interactions.createdAt))
        .limit(limit),
      db
        .select()
        .from(webhookErrorLogs)
        .where(eq(webhookErrorLogs.campaignId, id))
        .orderBy(desc(webhookErrorLogs.createdAt))
        .limit(limit),
      db
        .select({ count: sql<number>`count(*)` })
        .from(interactions)
        .where(eq(interactions.campaignId, id)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(webhookErrorLogs)
        .where(eq(webhookErrorLogs.campaignId, id)),
    ]);

    // Combine and sort by createdAt
    const combined = [
      ...successLogs.map(i => ({
        id: i.id,
        type: 'success' as const,
        interactionNumber: i.interactionNumber,
        sourceType: i.sourceType,
        sourcePlatform: i.sourcePlatform,
        phoneNumber: i.phoneNumber,
        callStatus: i.callStatus,
        rawPayload: i.rawPayload,
        createdAt: i.createdAt,
      })),
      ...errorLogs.map(e => ({
        id: e.id,
        type: 'error' as const,
        errorType: e.errorType,
        errorMessage: e.errorMessage,
        rawPayload: e.rawBody ? tryParseJson(e.rawBody) : null,
        createdAt: e.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
     .slice(0, limit);

    return NextResponse.json({
      data: combined,
      total: Number(successCount[0]?.count || 0) + Number(errorCount[0]?.count || 0),
      successCount: Number(successCount[0]?.count || 0),
      errorCount: Number(errorCount[0]?.count || 0),
      page,
      limit,
    });
  } catch (error) {
    console.error('[Campaign Webhooks API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch webhook logs' },
      { status: 500 }
    );
  }
}

function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
