import { NextResponse } from 'next/server';
import { db } from '@/db';
import { leads, commissions, salesUsers, leadStages } from '@/db/schema';
import { eq, and, sql, gte, desc, isNotNull, lte } from 'drizzle-orm';
import { requireSalesAuth } from '@/lib/auth';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';

// GET /api/sales/dashboard - Get sales dashboard data
export async function GET() {
  const log = createApiLogger('/api/sales/dashboard');

  try {
    const salesUser = await requireSalesAuth();
    log.info('Fetching dashboard', { userId: salesUser.id });

    // Rate limiting
    const rateLimit = withRateLimit(salesUser.id, 'sales-dashboard-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    // Get date for "this month"
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get lead stats
    const [leadStats] = await db
      .select({
        totalLeads: sql<number>`count(*)`,
        newLeadsThisMonth: sql<number>`count(*) filter (where ${leads.createdAt} >= ${startOfMonth})`,
        wonLeads: sql<number>`count(*) filter (where ${leads.status} = 'won')`,
      })
      .from(leads)
      .where(eq(leads.salesUserId, salesUser.id));

    // Calculate conversion rate
    const conversionRate = leadStats.totalLeads > 0
      ? (Number(leadStats.wonLeads) / Number(leadStats.totalLeads)) * 100
      : 0;

    // Get commission stats
    const [commissionStats] = await db
      .select({
        pendingCommissions: sql<number>`coalesce(sum(${commissions.commissionAmount}) filter (where ${commissions.status} = 'pending'), 0)`,
        paidCommissions: sql<number>`coalesce(sum(${commissions.commissionAmount}) filter (where ${commissions.status} = 'paid'), 0)`,
        totalEarnings: sql<number>`coalesce(sum(${commissions.commissionAmount}) filter (where ${commissions.status} in ('approved', 'paid')), 0)`,
      })
      .from(commissions)
      .where(eq(commissions.salesUserId, salesUser.id));

    // Get upcoming follow-ups count
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [followUpCount] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.salesUserId, salesUser.id),
          isNotNull(leads.nextFollowUpAt),
          gte(leads.nextFollowUpAt, now),
          lte(leads.nextFollowUpAt, nextWeek)
        )
      );

    // Get recent leads with stage info
    const recentLeads = await db.query.leads.findMany({
      where: eq(leads.salesUserId, salesUser.id),
      with: {
        stage: true,
      },
      orderBy: [desc(leads.createdAt)],
      limit: 5,
    });

    // Get upcoming follow-ups
    const upcomingFollowUps = await db.query.leads.findMany({
      where: and(
        eq(leads.salesUserId, salesUser.id),
        isNotNull(leads.nextFollowUpAt),
        gte(leads.nextFollowUpAt, now)
      ),
      orderBy: [leads.nextFollowUpAt],
      limit: 5,
    });

    // Get recent commissions
    const recentCommissions = await db.query.commissions.findMany({
      where: eq(commissions.salesUserId, salesUser.id),
      with: {
        lead: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [desc(commissions.createdAt)],
      limit: 5,
    });

    log.info('Dashboard fetched', { userId: salesUser.id });

    const response = NextResponse.json({
      stats: {
        totalLeads: Number(leadStats.totalLeads) || 0,
        newLeadsThisMonth: Number(leadStats.newLeadsThisMonth) || 0,
        wonLeads: Number(leadStats.wonLeads) || 0,
        conversionRate,
        pendingCommissions: Number(commissionStats.pendingCommissions) || 0,
        paidCommissions: Number(commissionStats.paidCommissions) || 0,
        totalEarnings: Number(commissionStats.totalEarnings) || 0,
        upcomingFollowUps: Number(followUpCount.count) || 0,
      },
      recentLeads,
      upcomingFollowUps,
      recentCommissions,
    });

    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to fetch dashboard', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
