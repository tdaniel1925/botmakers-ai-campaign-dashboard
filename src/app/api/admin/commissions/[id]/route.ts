import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { commissions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { updateCommissionSchema, validateRequest, uuidSchema } from '@/lib/validations/admin';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/admin/commissions/[id]');
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Validate UUID format
    if (!uuidSchema.safeParse(id).success) {
      log.warn('Invalid UUID format', { id });
      return NextResponse.json({ error: 'Invalid commission ID format' }, { status: 400 });
    }

    log.info('Updating commission', { userId: admin.id, commissionId: id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-commission-put', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(updateCommissionSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { details: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    const { status, notes } = validation.data;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (status !== undefined) {
      updateData.status = status;

      // If marking as paid, set paidAt
      if (status === 'paid' && existing.status !== 'paid') {
        updateData.paidAt = new Date();
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const [updated] = await db
      .update(commissions)
      .set(updateData)
      .where(eq(commissions.id, id))
      .returning();

    log.info('Commission updated', { commissionId: id, newStatus: status });
    return NextResponse.json(updated);
  } catch (error) {
    log.error('Failed to update commission', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to update commission' },
      { status: 500 }
    );
  }
}
