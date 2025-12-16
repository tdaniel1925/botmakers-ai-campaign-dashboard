import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { salesUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';

// POST /api/sales/dismiss-welcome - Mark welcome message as seen
export async function POST(request: NextRequest) {
  const log = createApiLogger('/api/sales/dismiss-welcome');

  try {
    const salesUser = await requireSalesAuth();
    log.info('Dismissing welcome message', { userId: salesUser.id, accessType: salesUser.accessType });

    // Rate limiting
    const rateLimit = withRateLimit(salesUser.id, 'sales-dismiss-welcome', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    // Admins/users_with_access don't have records in salesUsers table
    // They have hasSeenWelcome=true by default, so just return success
    if (salesUser.accessType !== 'sales_user') {
      log.info('Welcome dismiss skipped - user is not a sales_user', { accessType: salesUser.accessType });
      return NextResponse.json({ success: true });
    }

    // Update hasSeenWelcome flag for actual sales users
    await db
      .update(salesUsers)
      .set({
        hasSeenWelcome: true,
        updatedAt: new Date(),
      })
      .where(eq(salesUsers.id, salesUser.id));

    log.info('Welcome message dismissed', { userId: salesUser.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to dismiss welcome', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to dismiss welcome message' },
      { status: 500 }
    );
  }
}
