import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, interactions, webhookErrorLogs, organizations } from '@/db/schema';
import { eq, and, sql, gte, desc } from 'drizzle-orm';
import { requireFullAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/campaigns/[id]/stats - Get campaign statistics
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireFullAuth();
    const { id } = await params;

    // Get campaign with organization
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, id),
      with: {
        organization: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check access for client users
    if (user.role === 'client_user' && campaign.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get date range (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get overall stats
    const [statsResult] = await db
      .select({
        totalCalls: sql<number>`count(*)`,
        completedCalls: sql<number>`count(*) filter (where ${interactions.callStatus} = 'completed')`,
        failedCalls: sql<number>`count(*) filter (where ${interactions.callStatus} = 'failed')`,
        noAnswerCalls: sql<number>`count(*) filter (where ${interactions.callStatus} = 'no_answer')`,
        avgDuration: sql<number>`avg(${interactions.durationSeconds}) filter (where ${interactions.durationSeconds} is not null)`,
        totalDuration: sql<number>`sum(${interactions.durationSeconds}) filter (where ${interactions.durationSeconds} is not null)`,
      })
      .from(interactions)
      .where(eq(interactions.campaignId, id));

    // Get calls by day for the last 30 days
    const callsByDay = await db
      .select({
        date: sql<string>`date_trunc('day', ${interactions.createdAt})::date`,
        count: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where ${interactions.callStatus} = 'completed')`,
      })
      .from(interactions)
      .where(
        and(
          eq(interactions.campaignId, id),
          gte(interactions.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(sql`date_trunc('day', ${interactions.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${interactions.createdAt})::date`);

    // Get calls by status
    const callsByStatus = await db
      .select({
        status: interactions.callStatus,
        count: sql<number>`count(*)`,
      })
      .from(interactions)
      .where(eq(interactions.campaignId, id))
      .groupBy(interactions.callStatus);

    // Get calls by source type
    const callsBySource = await db
      .select({
        sourceType: interactions.sourceType,
        count: sql<number>`count(*)`,
      })
      .from(interactions)
      .where(eq(interactions.campaignId, id))
      .groupBy(interactions.sourceType);

    // Get webhook error count
    const [webhookErrorCount] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(webhookErrorLogs)
      .where(eq(webhookErrorLogs.campaignId, id));

    // Get recent webhook errors
    const recentErrors = await db
      .select()
      .from(webhookErrorLogs)
      .where(eq(webhookErrorLogs.campaignId, id))
      .orderBy(desc(webhookErrorLogs.createdAt))
      .limit(5);

    const stats = {
      totalCalls: Number(statsResult.totalCalls) || 0,
      completedCalls: Number(statsResult.completedCalls) || 0,
      failedCalls: Number(statsResult.failedCalls) || 0,
      noAnswerCalls: Number(statsResult.noAnswerCalls) || 0,
      avgDuration: Math.round(Number(statsResult.avgDuration) || 0),
      totalDuration: Number(statsResult.totalDuration) || 0,
      successRate: statsResult.totalCalls > 0
        ? Math.round((Number(statsResult.completedCalls) / Number(statsResult.totalCalls)) * 100)
        : 0,
      webhookErrors: Number(webhookErrorCount.count) || 0,
    };

    return NextResponse.json({
      campaign,
      stats,
      callsByDay: callsByDay.map(d => ({
        date: d.date,
        count: Number(d.count),
        completed: Number(d.completed),
      })),
      callsByStatus: callsByStatus.map(s => ({
        status: s.status || 'unknown',
        count: Number(s.count),
      })),
      callsBySource: callsBySource.map(s => ({
        sourceType: s.sourceType,
        count: Number(s.count),
      })),
      recentErrors,
    });
  } catch (error) {
    console.error('[Campaign Stats API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch campaign stats' },
      { status: 500 }
    );
  }
}
