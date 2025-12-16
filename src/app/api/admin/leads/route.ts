import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { leads, salesUsers, leadStages } from '@/db/schema';
import { eq, desc, and, ilike, sql, or } from 'drizzle-orm';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { sanitizeSearchInput } from '@/lib/validations/admin';

export async function GET(request: NextRequest) {
  const log = createApiLogger('/api/admin/leads');
  try {
    const admin = await requireAdmin();
    log.info('Fetching leads', { userId: admin.id });

    // Rate limiting
    const rateLimit = withRateLimit(admin.id, 'admin-leads-get', RATE_LIMITS.search);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const { searchParams } = new URL(request.url);

    // Sanitize and validate search params
    const rawSearch = searchParams.get('search');
    const search = rawSearch ? sanitizeSearchInput(rawSearch) : null;
    const salesUserId = searchParams.get('salesUserId');
    const stageId = searchParams.get('stageId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(leads.firstName, `%${search}%`),
          ilike(leads.lastName, `%${search}%`),
          ilike(leads.company, `%${search}%`),
          ilike(leads.email, `%${search}%`)
        )
      );
    }

    if (salesUserId && salesUserId !== 'all') {
      conditions.push(eq(leads.salesUserId, salesUserId));
    }

    if (stageId && stageId !== 'all') {
      if (stageId === 'unassigned') {
        conditions.push(sql`${leads.stageId} IS NULL`);
      } else {
        conditions.push(eq(leads.stageId, stageId));
      }
    }

    if (status && status !== 'all') {
      conditions.push(eq(leads.status, status as 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'));
    }

    // Get leads with related data
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
        notes: leads.notes,
        createdAt: leads.createdAt,
        salesUser: {
          id: salesUsers.id,
          fullName: salesUsers.fullName,
          email: salesUsers.email,
        },
        stage: {
          id: leadStages.id,
          name: leadStages.name,
          color: leadStages.color,
        },
      })
      .from(leads)
      .leftJoin(salesUsers, eq(leads.salesUserId, salesUsers.id))
      .leftJoin(leadStages, eq(leads.stageId, leadStages.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get filter options
    const allSalesUsers = await db
      .select({ id: salesUsers.id, fullName: salesUsers.fullName })
      .from(salesUsers)
      .where(eq(salesUsers.isActive, true))
      .orderBy(salesUsers.fullName);

    const allStages = await db
      .select()
      .from(leadStages)
      .where(eq(leadStages.isActive, true))
      .orderBy(leadStages.order);

    log.info('Leads fetched', { count: leadsData.length, total: count, page });
    return NextResponse.json({
      leads: leadsData,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
      filters: {
        salesUsers: allSalesUsers,
        stages: allStages,
      },
    });
  } catch (error) {
    log.error('Failed to fetch leads', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
