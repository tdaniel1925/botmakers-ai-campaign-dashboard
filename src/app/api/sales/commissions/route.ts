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
    const isObserver = salesUser.accessType !== 'sales_user';
    log.info('Fetching commissions', { userId: salesUser.id, accessType: salesUser.accessType, isObserver });

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

    // Build conditions - admins see all commissions, sales users see only their own
    const conditions: ReturnType<typeof eq>[] = [];

    if (!isObserver) {
      conditions.push(eq(commissions.salesUserId, salesUser.id));
    }

    if (status && status !== 'all') {
      conditions.push(eq(commissions.status, status as 'pending' | 'approved' | 'paid' | 'cancelled'));
    }

    if (startDate) {
      conditions.push(gte(commissions.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(commissions.createdAt, new Date(endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
      .where(whereClause)
      .orderBy(desc(commissions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(commissions)
      .where(whereClause);

    // Get summary stats (all commissions for observers, own commissions for sales users)
    const statsWhereClause = isObserver ? undefined : eq(commissions.salesUserId, salesUser.id);
    const statsQuery = db
      .select({
        totalPending: sql<number>`coalesce(sum(case when status = 'pending' then commission_amount else 0 end), 0)::int`,
        totalApproved: sql<number>`coalesce(sum(case when status = 'approved' then commission_amount else 0 end), 0)::int`,
        totalPaid: sql<number>`coalesce(sum(case when status = 'paid' then commission_amount else 0 end), 0)::int`,
        totalEarnings: sql<number>`coalesce(sum(case when status != 'cancelled' then commission_amount else 0 end), 0)::int`,
        totalSales: sql<number>`coalesce(sum(case when status != 'cancelled' then sale_amount else 0 end), 0)::int`,
        commissionCount: sql<number>`count(*)::int`,
      })
      .from(commissions);

    if (statsWhereClause) {
      statsQuery.where(statsWhereClause);
    }

    const [stats] = await statsQuery;

    log.info('Commissions fetched', { userId: salesUser.id, count: commissionsData.length, isObserver });

    const response = NextResponse.json({
      commissions: commissionsData,
      stats,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
      isObserver,
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
