import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { leads, commissions } from '@/db/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const salesUser = await requireSalesAuth();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Monthly stats
    const [monthlyLeads] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.salesUserId, salesUser.id),
          gte(leads.createdAt, startOfMonth)
        )
      );

    const [monthlyCommissions] = await db
      .select({
        total: sql<number>`coalesce(sum(commission_amount), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(commissions)
      .where(
        and(
          eq(commissions.salesUserId, salesUser.id),
          gte(commissions.createdAt, startOfMonth),
          sql`status != 'cancelled'`
        )
      );

    // Last month stats for comparison
    const [lastMonthLeads] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.salesUserId, salesUser.id),
          gte(leads.createdAt, startOfLastMonth),
          sql`created_at < ${startOfMonth}`
        )
      );

    const [lastMonthCommissions] = await db
      .select({
        total: sql<number>`coalesce(sum(commission_amount), 0)::int`,
      })
      .from(commissions)
      .where(
        and(
          eq(commissions.salesUserId, salesUser.id),
          gte(commissions.createdAt, startOfLastMonth),
          sql`created_at < ${startOfMonth}`,
          sql`status != 'cancelled'`
        )
      );

    // Quarterly stats
    const [quarterlyStats] = await db
      .select({
        leadsCount: sql<number>`count(distinct l.id)::int`,
        commissionsTotal: sql<number>`coalesce(sum(c.commission_amount), 0)::int`,
        salesTotal: sql<number>`coalesce(sum(c.sale_amount), 0)::int`,
        conversions: sql<number>`count(distinct c.lead_id)::int`,
      })
      .from(leads)
      .leftJoin(
        commissions,
        and(
          eq(commissions.leadId, leads.id),
          gte(commissions.createdAt, startOfQuarter),
          sql`c.status != 'cancelled'`
        )
      )
      .where(
        and(
          eq(leads.salesUserId, salesUser.id),
          gte(leads.createdAt, startOfQuarter)
        )
      );

    // Yearly stats
    const [yearlyStats] = await db
      .select({
        leadsCount: sql<number>`count(*)::int`,
        wonCount: sql<number>`count(case when status = 'won' then 1 end)::int`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.salesUserId, salesUser.id),
          gte(leads.createdAt, startOfYear)
        )
      );

    const [yearlyCommissions] = await db
      .select({
        total: sql<number>`coalesce(sum(commission_amount), 0)::int`,
        salesTotal: sql<number>`coalesce(sum(sale_amount), 0)::int`,
      })
      .from(commissions)
      .where(
        and(
          eq(commissions.salesUserId, salesUser.id),
          gte(commissions.createdAt, startOfYear),
          sql`status != 'cancelled'`
        )
      );

    // Monthly breakdown for chart (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyBreakdown = await db
      .select({
        month: sql<string>`to_char(created_at, 'YYYY-MM')`,
        leads: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.salesUserId, salesUser.id),
          gte(leads.createdAt, sixMonthsAgo)
        )
      )
      .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM')`);

    const commissionBreakdown = await db
      .select({
        month: sql<string>`to_char(created_at, 'YYYY-MM')`,
        total: sql<number>`coalesce(sum(commission_amount), 0)::int`,
      })
      .from(commissions)
      .where(
        and(
          eq(commissions.salesUserId, salesUser.id),
          gte(commissions.createdAt, sixMonthsAgo),
          sql`status != 'cancelled'`
        )
      )
      .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM')`);

    // Lead status breakdown
    const leadsByStatus = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(eq(leads.salesUserId, salesUser.id))
      .groupBy(leads.status);

    // Calculate conversion rate
    const totalLeadsAll = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.salesUserId, salesUser.id));

    const wonLeadsAll = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.salesUserId, salesUser.id), eq(leads.status, 'won')));

    const conversionRate =
      totalLeadsAll[0].count > 0
        ? (wonLeadsAll[0].count / totalLeadsAll[0].count) * 100
        : 0;

    // Calculate growth
    const leadsGrowth =
      lastMonthLeads.count > 0
        ? ((monthlyLeads.count - lastMonthLeads.count) / lastMonthLeads.count) * 100
        : monthlyLeads.count > 0
        ? 100
        : 0;

    const commissionsGrowth =
      lastMonthCommissions.total > 0
        ? ((monthlyCommissions.total - lastMonthCommissions.total) / lastMonthCommissions.total) * 100
        : monthlyCommissions.total > 0
        ? 100
        : 0;

    return NextResponse.json({
      monthly: {
        leads: monthlyLeads.count,
        leadsGrowth,
        commissions: monthlyCommissions.total,
        commissionsGrowth,
        conversions: monthlyCommissions.count,
      },
      quarterly: {
        leads: quarterlyStats?.leadsCount || 0,
        commissions: quarterlyStats?.commissionsTotal || 0,
        sales: quarterlyStats?.salesTotal || 0,
        conversions: quarterlyStats?.conversions || 0,
      },
      yearly: {
        leads: yearlyStats?.leadsCount || 0,
        won: yearlyStats?.wonCount || 0,
        commissions: yearlyCommissions?.total || 0,
        sales: yearlyCommissions?.salesTotal || 0,
      },
      conversionRate,
      monthlyBreakdown,
      commissionBreakdown,
      leadsByStatus,
    });
  } catch (error) {
    console.error('Failed to fetch performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance' },
      { status: 500 }
    );
  }
}
