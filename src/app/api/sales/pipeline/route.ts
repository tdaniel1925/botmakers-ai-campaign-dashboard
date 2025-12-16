import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { leads, leadStages } from '@/db/schema';
import { eq, and, sql, desc, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const salesUser = await requireSalesAuth();

    // Get all stages ordered by order
    const stages = await db
      .select()
      .from(leadStages)
      .where(eq(leadStages.isActive, true))
      .orderBy(asc(leadStages.order));

    // Get leads grouped by stage
    const leadsData = await db
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
      })
      .from(leads)
      .where(eq(leads.salesUserId, salesUser.id))
      .orderBy(desc(leads.createdAt));

    // Calculate stage totals
    const stageTotals = await db
      .select({
        stageId: leads.stageId,
        count: sql<number>`count(*)::int`,
        totalValue: sql<number>`coalesce(sum(estimated_value), 0)::int`,
      })
      .from(leads)
      .where(eq(leads.salesUserId, salesUser.id))
      .groupBy(leads.stageId);

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
    });
  } catch (error) {
    console.error('Failed to fetch pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline' },
      { status: 500 }
    );
  }
}
