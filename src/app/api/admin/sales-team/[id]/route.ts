import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { salesUsers, leads, commissions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { updateSalesUserSchema, validateRequest, uuidSchema } from '@/lib/validations/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/admin/sales-team/[id]');
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Validate UUID format
    if (!uuidSchema.safeParse(id).success) {
      log.warn('Invalid UUID format', { id });
      return NextResponse.json({ error: 'Invalid sales user ID format' }, { status: 400 });
    }

    log.info('Fetching sales user', { userId: admin.id, targetId: id });

    // Rate limiting
    const rateLimit = withRateLimit(admin.id, 'admin-sales-user-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const [salesUser] = await db
      .select()
      .from(salesUsers)
      .where(eq(salesUsers.id, id))
      .limit(1);

    if (!salesUser) {
      return NextResponse.json({ error: 'Sales user not found' }, { status: 404 });
    }

    // Get detailed stats
    const [leadStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        won: sql<number>`count(case when status = 'won' then 1 end)::int`,
        lost: sql<number>`count(case when status = 'lost' then 1 end)::int`,
        active: sql<number>`count(case when status not in ('won', 'lost') then 1 end)::int`,
      })
      .from(leads)
      .where(eq(leads.salesUserId, id));

    const [commissionStats] = await db
      .select({
        total: sql<number>`coalesce(sum(commission_amount), 0)::int`,
        pending: sql<number>`coalesce(sum(case when status = 'pending' then commission_amount else 0 end), 0)::int`,
        approved: sql<number>`coalesce(sum(case when status = 'approved' then commission_amount else 0 end), 0)::int`,
        paid: sql<number>`coalesce(sum(case when status = 'paid' then commission_amount else 0 end), 0)::int`,
        salesTotal: sql<number>`coalesce(sum(sale_amount), 0)::int`,
      })
      .from(commissions)
      .where(eq(commissions.salesUserId, id));

    log.info('Sales user fetched', { targetId: id });
    return NextResponse.json({
      ...salesUser,
      leadStats: leadStats || { total: 0, won: 0, lost: 0, active: 0 },
      commissionStats: commissionStats || {
        total: 0,
        pending: 0,
        approved: 0,
        paid: 0,
        salesTotal: 0,
      },
    });
  } catch (error) {
    log.error('Failed to fetch sales user', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to fetch sales user' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/admin/sales-team/[id]');
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Validate UUID format
    if (!uuidSchema.safeParse(id).success) {
      log.warn('Invalid UUID format', { id });
      return NextResponse.json({ error: 'Invalid sales user ID format' }, { status: 400 });
    }

    log.info('Updating sales user', { userId: admin.id, targetId: id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-sales-user-put', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(updateSalesUserSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { details: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { fullName, phone, commissionRate, isActive, bio } = validation.data;

    const [salesUser] = await db
      .select()
      .from(salesUsers)
      .where(eq(salesUsers.id, id))
      .limit(1);

    if (!salesUser) {
      return NextResponse.json({ error: 'Sales user not found' }, { status: 404 });
    }

    const [updated] = await db
      .update(salesUsers)
      .set({
        fullName: fullName !== undefined ? fullName : salesUser.fullName,
        phone: phone !== undefined ? phone : salesUser.phone,
        commissionRate: commissionRate !== undefined ? commissionRate : salesUser.commissionRate,
        isActive: isActive !== undefined ? isActive : salesUser.isActive,
        bio: bio !== undefined ? bio : salesUser.bio,
        updatedAt: new Date(),
      })
      .where(eq(salesUsers.id, id))
      .returning();

    log.info('Sales user updated', { targetId: id });
    return NextResponse.json(updated);
  } catch (error) {
    log.error('Failed to update sales user', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to update sales user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/admin/sales-team/[id]');
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Validate UUID format
    if (!uuidSchema.safeParse(id).success) {
      log.warn('Invalid UUID format', { id });
      return NextResponse.json({ error: 'Invalid sales user ID format' }, { status: 400 });
    }

    log.info('Deleting sales user', { userId: admin.id, targetId: id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-sales-user-delete', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    // Check if sales user has leads
    const [leadCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.salesUserId, id));

    if (leadCount.count > 0) {
      // Soft delete - just deactivate
      await db
        .update(salesUsers)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(salesUsers.id, id));

      log.info('Sales user deactivated (has leads)', { targetId: id, leadCount: leadCount.count });
      return NextResponse.json({
        message: 'Sales user deactivated (has associated leads)',
      });
    }

    // Hard delete if no leads
    await db.delete(salesUsers).where(eq(salesUsers.id, id));

    log.info('Sales user deleted', { targetId: id });
    return NextResponse.json({ message: 'Sales user deleted' });
  } catch (error) {
    log.error('Failed to delete sales user', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to delete sales user' },
      { status: 500 }
    );
  }
}
