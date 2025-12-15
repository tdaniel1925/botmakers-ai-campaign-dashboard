import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { interactions, campaigns, organizations, smsLogs } from '@/db/schema';
import { eq, and, gte, lte, sql, count, inArray, desc } from 'drizzle-orm';
import { requireFullAuth } from '@/lib/auth';

// GET /api/reports - Generate report data
export async function GET(request: NextRequest) {
  try {
    const user = await requireFullAuth();
    const searchParams = request.nextUrl.searchParams;

    // Filters
    const organizationId = searchParams.get('organizationId');
    const campaignId = searchParams.get('campaignId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const reportType = searchParams.get('type') || 'summary';

    // Build date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get allowed campaign IDs based on user role
    let allowedCampaignIds: string[] = [];

    if (user.role === 'client_user') {
      if (!user.organizationId) {
        return NextResponse.json({ data: {} });
      }
      const orgCampaigns = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.organizationId, user.organizationId));
      allowedCampaignIds = orgCampaigns.map(c => c.id);
    } else if (organizationId) {
      const orgCampaigns = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.organizationId, organizationId));
      allowedCampaignIds = orgCampaigns.map(c => c.id);
    } else if (campaignId) {
      allowedCampaignIds = [campaignId];
    }

    // Build conditions
    const conditions = [
      gte(interactions.createdAt, start),
      lte(interactions.createdAt, end),
    ];

    if (allowedCampaignIds.length > 0) {
      conditions.push(inArray(interactions.campaignId, allowedCampaignIds));
    }

    if (campaignId) {
      // Verify access if client user
      if (user.role === 'client_user' && !allowedCampaignIds.includes(campaignId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      conditions.push(eq(interactions.campaignId, campaignId));
    }

    const whereClause = and(...conditions);

    if (reportType === 'summary') {
      // Get summary statistics
      const [
        totalInteractions,
        completedCalls,
        totalCalls,
        totalDuration,
        statusBreakdown,
        sourceBreakdown,
        dailyTrend,
      ] = await Promise.all([
        // Total interactions
        db.select({ count: count() })
          .from(interactions)
          .where(whereClause),

        // Completed calls
        db.select({ count: count() })
          .from(interactions)
          .where(and(whereClause, eq(interactions.callStatus, 'completed'))),

        // Total phone calls
        db.select({ count: count() })
          .from(interactions)
          .where(and(whereClause, eq(interactions.sourceType, 'phone'))),

        // Total duration
        db.select({ total: sql<number>`COALESCE(SUM(${interactions.durationSeconds}), 0)` })
          .from(interactions)
          .where(whereClause),

        // Status breakdown
        db.select({
          status: interactions.callStatus,
          count: count(),
        })
          .from(interactions)
          .where(whereClause)
          .groupBy(interactions.callStatus),

        // Source breakdown
        db.select({
          source: interactions.sourceType,
          count: count(),
        })
          .from(interactions)
          .where(whereClause)
          .groupBy(interactions.sourceType),

        // Daily trend (last 30 days)
        db.select({
          date: sql<string>`DATE(${interactions.createdAt})`,
          count: count(),
        })
          .from(interactions)
          .where(whereClause)
          .groupBy(sql`DATE(${interactions.createdAt})`)
          .orderBy(sql`DATE(${interactions.createdAt})`),
      ]);

      // Get SMS statistics
      const smsConditions = [
        gte(smsLogs.sentAt, start),
        lte(smsLogs.sentAt, end),
      ];

      const [smsSent, smsDelivered, smsFailed] = await Promise.all([
        db.select({ count: count() }).from(smsLogs).where(and(...smsConditions)),
        db.select({ count: count() }).from(smsLogs).where(and(...smsConditions, eq(smsLogs.status, 'delivered'))),
        db.select({ count: count() }).from(smsLogs).where(and(...smsConditions, eq(smsLogs.status, 'failed'))),
      ]);

      const completionRate = totalCalls[0]?.count > 0
        ? Math.round((completedCalls[0]?.count / totalCalls[0]?.count) * 100)
        : 0;

      const avgDuration = totalInteractions[0]?.count > 0
        ? Math.round(totalDuration[0]?.total / totalInteractions[0]?.count)
        : 0;

      return NextResponse.json({
        data: {
          summary: {
            totalInteractions: totalInteractions[0]?.count || 0,
            completedCalls: completedCalls[0]?.count || 0,
            totalCalls: totalCalls[0]?.count || 0,
            completionRate,
            totalDurationSeconds: totalDuration[0]?.total || 0,
            avgDurationSeconds: avgDuration,
            smsSent: smsSent[0]?.count || 0,
            smsDelivered: smsDelivered[0]?.count || 0,
            smsFailed: smsFailed[0]?.count || 0,
          },
          statusBreakdown: statusBreakdown.reduce((acc, item) => {
            acc[item.status || 'pending'] = item.count;
            return acc;
          }, {} as Record<string, number>),
          sourceBreakdown: sourceBreakdown.reduce((acc, item) => {
            acc[item.source] = item.count;
            return acc;
          }, {} as Record<string, number>),
          dailyTrend,
          dateRange: { start: start.toISOString(), end: end.toISOString() },
        },
      });
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  } catch (error) {
    console.error('[Reports API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 }
    );
  }
}
