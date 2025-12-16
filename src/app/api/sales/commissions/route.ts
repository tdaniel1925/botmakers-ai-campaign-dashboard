import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { commissions, leads } from '@/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const log = createApiLogger('/api/sales/commissions');

  try {
    const salesUser = await requireSalesAuth();
    log.info('Fetching commissions', { userId: salesUser.id });

    // Rate limiting
    const rateLimit = withRateLimit(salesUser.id, 'sales-commissions-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(commissions.salesUserId, salesUser.id)];

    if (status && status !== 'all') {
      conditions.push(eq(commissions.status, status as 'pending' | 'approved' | 'paid' | 'cancelled'));
    }

    if (startDate) {
      conditions.push(gte(commissions.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(commissions.createdAt, new Date(endDate)));
    }

    // Get commissions with lead info
    const commissionsData = await db
      .select({
        id: commissions.id,
        leadId: commissions.leadId,
        saleAmount: commissions.saleAmount,
        commissionRate: commissions.commissionRate,
        commissionAmount: commissions.commissionAmount,
        status: commissions.status,
        paidAt: commissions.paidAt,
        notes: commissions.notes,
        createdAt: commissions.createdAt,
        lead: {
          firstName: leads.firstName,
          lastName: leads.lastName,
          company: leads.company,
        },
      })
      .from(commissions)
      .leftJoin(leads, eq(commissions.leadId, leads.id))
      .where(and(...conditions))
      .orderBy(desc(commissions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(commissions)
      .where(and(...conditions));

    // Get summary stats
    const [stats] = await db
      .select({
        totalPending: sql<number>`coalesce(sum(case when status = 'pending' then commission_amount else 0 end), 0)::int`,
        totalApproved: sql<number>`coalesce(sum(case when status = 'approved' then commission_amount else 0 end), 0)::int`,
        totalPaid: sql<number>`coalesce(sum(case when status = 'paid' then commission_amount else 0 end), 0)::int`,
        totalEarnings: sql<number>`coalesce(sum(case when status != 'cancelled' then commission_amount else 0 end), 0)::int`,
        totalSales: sql<number>`coalesce(sum(case when status != 'cancelled' then sale_amount else 0 end), 0)::int`,
        commissionCount: sql<number>`count(*)::int`,
      })
      .from(commissions)
      .where(eq(commissions.salesUserId, salesUser.id));

    log.info('Commissions fetched', { userId: salesUser.id, count: commissionsData.length });

    const response = NextResponse.json({
      commissions: commissionsData,
      stats,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });

    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to fetch commissions', error);
    return NextResponse.json(
      { error: 'Failed to fetch commissions' },
      { status: 500 }
    );
  }
}
