import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { salesUsers, leads, commissions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { updateProfileSchema, validateRequest } from '@/lib/validations/sales';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const log = createApiLogger('/api/sales/profile');

  try {
    const salesUser = await requireSalesAuth();
    log.info('Fetching profile', { userId: salesUser.id, accessType: salesUser.accessType });

    // Rate limiting
    const rateLimit = withRateLimit(salesUser.id, 'sales-profile-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    // For admins/users_with_access, return profile with zeroed stats
    // They don't have their own leads/commissions - they view the portal as observers
    if (salesUser.accessType !== 'sales_user') {
      log.info('Admin/observer profile fetched', { userId: salesUser.id, accessType: salesUser.accessType });
      const response = NextResponse.json({
        profile: salesUser,
        stats: {
          totalLeads: 0,
          wonLeads: 0,
          conversionRate: 0,
          totalEarnings: 0,
          paidAmount: 0,
        },
        isObserver: true, // Flag to indicate this user is viewing as an observer
      });

      Object.entries(rateLimit.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    // Get profile with stats for actual sales users
    const [stats] = await db
      .select({
        totalLeads: sql<number>`count(*)::int`,
        wonLeads: sql<number>`count(case when status = 'won' then 1 end)::int`,
      })
      .from(leads)
      .where(eq(leads.salesUserId, salesUser.id));

    const [commissionStats] = await db
      .select({
        totalEarnings: sql<number>`coalesce(sum(case when status != 'cancelled' then commission_amount else 0 end), 0)::int`,
        paidAmount: sql<number>`coalesce(sum(case when status = 'paid' then commission_amount else 0 end), 0)::int`,
      })
      .from(commissions)
      .where(eq(commissions.salesUserId, salesUser.id));

    log.info('Profile fetched', { userId: salesUser.id });

    const response = NextResponse.json({
      profile: salesUser,
      stats: {
        totalLeads: stats?.totalLeads || 0,
        wonLeads: stats?.wonLeads || 0,
        conversionRate:
          stats && stats.totalLeads > 0
            ? (stats.wonLeads / stats.totalLeads) * 100
            : 0,
        totalEarnings: commissionStats?.totalEarnings || 0,
        paidAmount: commissionStats?.paidAmount || 0,
      },
    });

    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to fetch profile', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const log = createApiLogger('/api/sales/profile');

  try {
    const salesUser = await requireSalesAuth();
    log.info('Updating profile', { userId: salesUser.id, accessType: salesUser.accessType });

    // Admins and users_with_access cannot update their "sales profile" - they don't have one
    if (salesUser.accessType !== 'sales_user') {
      log.info('Profile update rejected - user is not a sales_user', { accessType: salesUser.accessType });
      return NextResponse.json(
        { error: 'Profile updates are only available for sales team members' },
        { status: 403 }
      );
    }

    // Rate limiting for write operations
    const rateLimit = withRateLimit(salesUser.id, 'sales-profile-put', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(updateProfileSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { userId: salesUser.id, errors: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { fullName, phone, bio } = validation.data;

    // Only allow updating certain fields
    const [updated] = await db
      .update(salesUsers)
      .set({
        fullName: fullName || salesUser.fullName,
        phone: phone !== undefined ? phone : salesUser.phone,
        bio: bio !== undefined ? bio : salesUser.bio,
        updatedAt: new Date(),
      })
      .where(eq(salesUsers.id, salesUser.id))
      .returning();

    log.info('Profile updated', { userId: salesUser.id });

    const response = NextResponse.json(updated);
    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to update profile', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
