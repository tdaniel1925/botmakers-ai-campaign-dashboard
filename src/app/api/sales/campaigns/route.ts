import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { campaigns, nurtureEnrollments, leads } from '@/db/schema';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const salesUser = await requireSalesAuth();

    // Get all active campaigns
    const campaignsData = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        campaignType: campaigns.campaignType,
        isActive: campaigns.isActive,
        createdAt: campaigns.createdAt,
      })
      .from(campaigns)
      .where(eq(campaigns.isActive, true))
      .orderBy(desc(campaigns.createdAt));

    // Get enrollment counts for each campaign for this sales user's leads
    const salesUserLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.salesUserId, salesUser.id));

    const leadIds = salesUserLeads.map((l) => l.id);

    let enrollmentCounts: Record<string, number> = {};
    if (leadIds.length > 0) {
      const counts = await db
        .select({
          campaignId: nurtureEnrollments.campaignId,
          count: sql<number>`count(*)::int`,
        })
        .from(nurtureEnrollments)
        .where(inArray(nurtureEnrollments.leadId, leadIds))
        .groupBy(nurtureEnrollments.campaignId);

      enrollmentCounts = counts.reduce((acc, c) => {
        acc[c.campaignId] = c.count;
        return acc;
      }, {} as Record<string, number>);
    }

    const campaignsWithCounts = campaignsData.map((campaign) => ({
      ...campaign,
      myEnrollments: enrollmentCounts[campaign.id] || 0,
    }));

    return NextResponse.json(campaignsWithCounts);
  } catch (error) {
    console.error('Failed to fetch campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}
