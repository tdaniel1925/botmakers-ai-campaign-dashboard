import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { leads, commissions, salesUsers } from '@/db/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const salesUser = await requireSalesAuth();
    const isObserver = salesUser.accessType !== 'sales_user';

    // Observers can optionally filter by a specific sales user
    const { searchParams } = new URL(request.url);
    const filterSalesUserId = searchParams.get('salesUserId');

    // Determine the target sales user ID for filtering
    let targetUserId: string | undefined;
    if (isObserver) {
      targetUserId = filterSalesUserId || undefined; // undefined = show all
    } else {
      targetUserId = salesUser.id; // Sales users only see their own data
    }

    // Get list of sales users for filter dropdown (observers only)
    let salesUsersList: { id: string; name: string }[] = [];
    if (isObserver) {
      const users = await db
        .select({
          id: salesUsers.id,
          fullName: salesUsers.fullName,
        })
        .from(salesUsers)
        .where(eq(salesUsers.isActive, true))
        .orderBy(salesUsers.fullName);
      salesUsersList = users.map(u => ({
        id: u.id,
        name: u.fullName,
      }));
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Build filter conditions
    const leadsUserFilter = targetUserId ? eq(leads.salesUserId, targetUserId) : undefined;
    const commissionsUserFilter = targetUserId ? eq(commissions.salesUserId, targetUserId) : undefined;

    // Monthly stats
    const monthlyLeadsConditions = [gte(leads.createdAt, startOfMonth)];
    if (leadsUserFilter) monthlyLeadsConditions.push(leadsUserFilter);

    const [monthlyLeads] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...monthlyLeadsConditions));

    const monthlyCommissionsConditions = [
      gte(commissions.createdAt, startOfMonth),
      sql`status != 'cancelled'`
    ];
    if (commissionsUserFilter) monthlyCommissionsConditions.push(commissionsUserFilter);

    const [monthlyCommissions] = await db
      .select({
        total: sql<number>`coalesce(sum(commission_amount), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(commissions)
      .where(and(...monthlyCommissionsConditions));

    // Last month stats for comparison
    const lastMonthLeadsConditions = [
      gte(leads.createdAt, startOfLastMonth),
      sql`created_at < ${startOfMonth}`
    ];
    if (leadsUserFilter) lastMonthLeadsConditions.push(leadsUserFilter);

    const [lastMonthLeads] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...lastMonthLeadsConditions));

    const lastMonthCommissionsConditions = [
      gte(commissions.createdAt, startOfLastMonth),
      sql`created_at < ${startOfMonth}`,
      sql`status != 'cancelled'`
    ];
    if (commissionsUserFilter) lastMonthCommissionsConditions.push(commissionsUserFilter);

    const [lastMonthCommissions] = await db
      .select({
        total: sql<number>`coalesce(sum(commission_amount), 0)::int`,
      })
      .from(commissions)
      .where(and(...lastMonthCommissionsConditions));

    // Quarterly stats
    const quarterlyLeadsConditions = [gte(leads.createdAt, startOfQuarter)];
    if (leadsUserFilter) quarterlyLeadsConditions.push(leadsUserFilter);

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
      .where(and(...quarterlyLeadsConditions));

    // Yearly stats
    const yearlyLeadsConditions = [gte(leads.createdAt, startOfYear)];
    if (leadsUserFilter) yearlyLeadsConditions.push(leadsUserFilter);

    const [yearlyStats] = await db
      .select({
        leadsCount: sql<number>`count(*)::int`,
        wonCount: sql<number>`count(case when status = 'won' then 1 end)::int`,
      })
      .from(leads)
      .where(and(...yearlyLeadsConditions));

    const yearlyCommissionsConditions = [
      gte(commissions.createdAt, startOfYear),
      sql`status != 'cancelled'`
    ];
    if (commissionsUserFilter) yearlyCommissionsConditions.push(commissionsUserFilter);

    const [yearlyCommissions] = await db
      .select({
        total: sql<number>`coalesce(sum(commission_amount), 0)::int`,
        salesTotal: sql<number>`coalesce(sum(sale_amount), 0)::int`,
      })
      .from(commissions)
      .where(and(...yearlyCommissionsConditions));

    // Monthly breakdown for chart (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyBreakdownConditions = [gte(leads.createdAt, sixMonthsAgo)];
    if (leadsUserFilter) monthlyBreakdownConditions.push(leadsUserFilter);

    const monthlyBreakdown = await db
      .select({
        month: sql<string>`to_char(created_at, 'YYYY-MM')`,
        leads: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(and(...monthlyBreakdownConditions))
      .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM')`);

    const commissionBreakdownConditions = [
      gte(commissions.createdAt, sixMonthsAgo),
      sql`status != 'cancelled'`
    ];
    if (commissionsUserFilter) commissionBreakdownConditions.push(commissionsUserFilter);

    const commissionBreakdown = await db
      .select({
        month: sql<string>`to_char(created_at, 'YYYY-MM')`,
        total: sql<number>`coalesce(sum(commission_amount), 0)::int`,
      })
      .from(commissions)
      .where(and(...commissionBreakdownConditions))
      .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM')`);

    // Lead status breakdown
    const leadsByStatusQuery = db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leads);

    const leadsByStatus = leadsUserFilter
      ? await leadsByStatusQuery.where(leadsUserFilter).groupBy(leads.status)
      : await leadsByStatusQuery.groupBy(leads.status);

    // Calculate conversion rate
    const totalLeadsAllQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads);

    const totalLeadsAll = leadsUserFilter
      ? await totalLeadsAllQuery.where(leadsUserFilter)
      : await totalLeadsAllQuery;

    const wonLeadsAllConditions = [eq(leads.status, 'won')];
    if (leadsUserFilter) wonLeadsAllConditions.push(leadsUserFilter);

    const wonLeadsAll = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...wonLeadsAllConditions));

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
      isObserver,
      salesUsers: salesUsersList,
      filterSalesUserId: filterSalesUserId || null,
    });
  } catch (error) {
    console.error('Failed to fetch performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance' },
      { status: 500 }
    );
  }
}
