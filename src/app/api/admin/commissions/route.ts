import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { commissions, leads, salesUsers, leadActivities } from '@/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { createCommissionSchema, validateRequest } from '@/lib/validations/admin';

export async function GET(request: NextRequest) {
  const log = createApiLogger('/api/admin/commissions');
  try {
    const admin = await requireAdmin();
    log.info('Fetching commissions', { userId: admin.id });

    // Rate limiting
    const rateLimit = withRateLimit(admin.id, 'admin-commissions-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const salesUserId = searchParams.get('salesUserId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push(eq(commissions.status, status as 'pending' | 'approved' | 'paid' | 'cancelled'));
    }

    if (salesUserId && salesUserId !== 'all') {
      conditions.push(eq(commissions.salesUserId, salesUserId));
    }

    if (startDate) {
      conditions.push(gte(commissions.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(commissions.createdAt, new Date(endDate)));
    }

    // Get commissions with related data
    const commissionsData = await db
      .select({
        id: commissions.id,
        saleAmount: commissions.saleAmount,
        commissionRate: commissions.commissionRate,
        commissionAmount: commissions.commissionAmount,
        status: commissions.status,
        paidAt: commissions.paidAt,
        notes: commissions.notes,
        createdAt: commissions.createdAt,
        salesUser: {
          id: salesUsers.id,
          fullName: salesUsers.fullName,
          email: salesUsers.email,
        },
        lead: {
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
          company: leads.company,
        },
      })
      .from(commissions)
      .leftJoin(salesUsers, eq(commissions.salesUserId, salesUsers.id))
      .leftJoin(leads, eq(commissions.leadId, leads.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(commissions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(commissions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get stats
    const [stats] = await db
      .select({
        totalPending: sql<number>`coalesce(sum(case when status = 'pending' then commission_amount else 0 end), 0)::int`,
        totalApproved: sql<number>`coalesce(sum(case when status = 'approved' then commission_amount else 0 end), 0)::int`,
        totalPaid: sql<number>`coalesce(sum(case when status = 'paid' then commission_amount else 0 end), 0)::int`,
        totalAll: sql<number>`coalesce(sum(case when status != 'cancelled' then commission_amount else 0 end), 0)::int`,
        countPending: sql<number>`count(case when status = 'pending' then 1 end)::int`,
        countApproved: sql<number>`count(case when status = 'approved' then 1 end)::int`,
      })
      .from(commissions);

    // Get all sales users for filter
    const allSalesUsers = await db
      .select({ id: salesUsers.id, fullName: salesUsers.fullName })
      .from(salesUsers)
      .orderBy(salesUsers.fullName);

    log.info('Commissions fetched', { count: commissionsData.length, total: count, page });
    return NextResponse.json({
      commissions: commissionsData,
      stats,
      filters: { salesUsers: allSalesUsers },
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    log.error('Failed to fetch commissions', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to fetch commissions' },
      { status: 500 }
    );
  }
}

// POST /api/admin/commissions - Create a new commission (admin review required)
export async function POST(request: NextRequest) {
  const log = createApiLogger('/api/admin/commissions');
  try {
    const admin = await requireAdmin();
    log.info('Creating commission', { userId: admin.id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-commissions-post', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(createCommissionSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { details: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { leadId, salesUserId, saleAmount, commissionRate, status, notes } = validation.data;

    // Verify lead exists
    const [lead] = await db
      .select({ id: leads.id, salesUserId: leads.salesUserId })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify sales user exists
    const [salesUser] = await db
      .select({ id: salesUsers.id })
      .from(salesUsers)
      .where(eq(salesUsers.id, salesUserId))
      .limit(1);

    if (!salesUser) {
      return NextResponse.json({ error: 'Sales user not found' }, { status: 404 });
    }

    // Check if commission already exists for this lead
    const [existingCommission] = await db
      .select({ id: commissions.id })
      .from(commissions)
      .where(eq(commissions.leadId, leadId))
      .limit(1);

    if (existingCommission) {
      return NextResponse.json(
        { error: 'A commission already exists for this lead' },
        { status: 400 }
      );
    }

    // Calculate commission amount
    const commissionAmount = Math.round((saleAmount * commissionRate) / 100);

    // Create the commission
    const [newCommission] = await db
      .insert(commissions)
      .values({
        leadId,
        salesUserId,
        saleAmount,
        commissionRate,
        commissionAmount,
        status: status || 'pending',
        notes: notes || null,
      })
      .returning();

    // Log activity on the lead
    await db.insert(leadActivities).values({
      leadId,
      userId: admin.id,
      userType: 'admin',
      activityType: 'commission_created',
      title: 'Commission created',
      description: `Commission of ${commissionRate}% ($${commissionAmount.toLocaleString()}) created by administrator`,
      metadata: { commissionId: newCommission.id, commissionRate, commissionAmount, saleAmount },
    });

    log.info('Commission created', { commissionId: newCommission.id, leadId, salesUserId, status });
    return NextResponse.json(newCommission, { status: 201 });
  } catch (error) {
    log.error('Failed to create commission', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to create commission' },
      { status: 500 }
    );
  }
}
