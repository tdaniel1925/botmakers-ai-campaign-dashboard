import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { leads, leadStages, salesUsers } from '@/db/schema';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const salesUser = await requireSalesAuth();
    const isObserver = salesUser.accessType !== 'sales_user';

    // Observers can optionally filter by a specific sales user
    const { searchParams } = new URL(request.url);
    const filterSalesUserId = searchParams.get('salesUserId');

    // Determine the user filter condition
    let userFilter: SQL | undefined;
    if (isObserver) {
      // Observer: optionally filter by specific sales user, or show all
      if (filterSalesUserId) {
        userFilter = eq(leads.salesUserId, filterSalesUserId);
      }
      // If no filter, userFilter stays undefined (show all)
    } else {
      // Sales user: always filter to their own leads
      userFilter = eq(leads.salesUserId, salesUser.id);
    }

    // Get all stages ordered by order
    const stages = await db
      .select()
      .from(leadStages)
      .where(eq(leadStages.isActive, true))
      .orderBy(asc(leadStages.order));

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

    // Get leads grouped by stage
    const leadsQuery = db
      .select({
        id: leads.id,
        leadNumber: leads.leadNumber,
        firstName: leads.firstName,
        lastName: leads.lastName,
        company: leads.company,
        email: leads.email,
        phone: leads.phone,
        status: leads.status,
        stageId: leads.stageId,
        estimatedValue: leads.estimatedValue,
        nextFollowUpAt: leads.nextFollowUpAt,
        createdAt: leads.createdAt,
        salesUserId: leads.salesUserId,
      })
      .from(leads);

    const leadsData = userFilter
      ? await leadsQuery.where(userFilter).orderBy(desc(leads.createdAt))
      : await leadsQuery.orderBy(desc(leads.createdAt));

    // Calculate stage totals
    const stageTotalsQuery = db
      .select({
        stageId: leads.stageId,
        count: sql<number>`count(*)::int`,
        totalValue: sql<number>`coalesce(sum(estimated_value), 0)::int`,
      })
      .from(leads);

    const stageTotals = userFilter
      ? await stageTotalsQuery.where(userFilter).groupBy(leads.stageId)
      : await stageTotalsQuery.groupBy(leads.stageId);

    const stageStats = stageTotals.reduce((acc, s) => {
      acc[s.stageId || 'unassigned'] = { count: s.count, totalValue: s.totalValue };
      return acc;
    }, {} as Record<string, { count: number; totalValue: number }>);

    // Group leads by stage
    const leadsByStage: Record<string, typeof leadsData> = { unassigned: [] };
    stages.forEach((stage) => {
      leadsByStage[stage.id] = [];
    });

    leadsData.forEach((lead) => {
      const key = lead.stageId || 'unassigned';
      if (leadsByStage[key]) {
        leadsByStage[key].push(lead);
      } else {
        leadsByStage['unassigned'].push(lead);
      }
    });

    return NextResponse.json({
      stages,
      leadsByStage,
      stageStats,
      totalLeads: leadsData.length,
      totalValue: leadsData.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
      isObserver,
      salesUsers: salesUsersList,
      filterSalesUserId: filterSalesUserId || null,
    });
  } catch (error) {
    console.error('Failed to fetch pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline' },
      { status: 500 }
    );
  }
}
