import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { salesUsers, leads, commissions } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { createSalesUserSchema, validateRequest } from '@/lib/validations/admin';
import { sendSalesWelcomeEmail } from '@/services/email-service';

export async function GET(request: NextRequest) {
  const log = createApiLogger('/api/admin/sales-team');
  try {
    const admin = await requireAdmin();
    log.info('Fetching sales team', { userId: admin.id });

    // Rate limiting
    const rateLimit = withRateLimit(admin.id, 'admin-sales-team-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    // Get all sales users with their stats
    const salesUsersData = await db
      .select({
        id: salesUsers.id,
        email: salesUsers.email,
        fullName: salesUsers.fullName,
        phone: salesUsers.phone,
        commissionRate: salesUsers.commissionRate,
        isActive: salesUsers.isActive,
        createdAt: salesUsers.createdAt,
      })
      .from(salesUsers)
      .orderBy(desc(salesUsers.createdAt));

    // Get lead counts for each sales user
    const leadCounts = await db
      .select({
        salesUserId: leads.salesUserId,
        total: sql<number>`count(*)::int`,
        won: sql<number>`count(case when status = 'won' then 1 end)::int`,
      })
      .from(leads)
      .groupBy(leads.salesUserId);

    const leadCountMap = leadCounts.reduce((acc, c) => {
      acc[c.salesUserId] = { total: c.total, won: c.won };
      return acc;
    }, {} as Record<string, { total: number; won: number }>);

    // Get commission totals for each sales user
    const commissionTotals = await db
      .select({
        salesUserId: commissions.salesUserId,
        total: sql<number>`coalesce(sum(commission_amount), 0)::int`,
        pending: sql<number>`coalesce(sum(case when status = 'pending' then commission_amount else 0 end), 0)::int`,
      })
      .from(commissions)
      .where(sql`status != 'cancelled'`)
      .groupBy(commissions.salesUserId);

    const commissionMap = commissionTotals.reduce((acc, c) => {
      acc[c.salesUserId] = { total: c.total, pending: c.pending };
      return acc;
    }, {} as Record<string, { total: number; pending: number }>);

    const enrichedSalesUsers = salesUsersData.map((user) => ({
      ...user,
      leadStats: leadCountMap[user.id] || { total: 0, won: 0 },
      commissionStats: commissionMap[user.id] || { total: 0, pending: 0 },
    }));

    log.info('Sales team fetched', { count: enrichedSalesUsers.length });
    return NextResponse.json(enrichedSalesUsers);
  } catch (error) {
    log.error('Failed to fetch sales team', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to fetch sales team' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const log = createApiLogger('/api/admin/sales-team');
  try {
    const admin = await requireAdmin();
    log.info('Creating sales user', { userId: admin.id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-sales-team-post', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(createSalesUserSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { details: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { email, fullName, phone, password, commissionRate } = validation.data;
    const { sendEmail = true } = body; // Optional: whether to send welcome email (defaults to true)

    // Check if email already exists in sales_users table
    const [existingSalesUser] = await db
      .select()
      .from(salesUsers)
      .where(eq(salesUsers.email, email))
      .limit(1);

    if (existingSalesUser) {
      return NextResponse.json(
        { error: 'A sales user with this email already exists' },
        { status: 400 }
      );
    }

    // Create auth user in Supabase
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      log.error('Supabase auth error', { error: authError.message, code: authError.code });
      // Provide more user-friendly error messages
      let errorMessage = authError.message;
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        errorMessage = 'This email is already registered in the system';
      } else if (authError.message.includes('not allowed') || authError.message.includes('not permitted')) {
        errorMessage = 'Unable to create user. Please check Supabase admin permissions.';
      }
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Create sales user record
    const [salesUser] = await db
      .insert(salesUsers)
      .values({
        id: authData.user.id,
        email,
        fullName,
        phone: phone || null,
        commissionRate: commissionRate || 18,
        isActive: true,
        mustChangePassword: true,
        hasSeenWelcome: false,
      })
      .returning();

    // Send welcome email with credentials if requested
    let emailSent = false;
    if (sendEmail) {
      const emailResult = await sendSalesWelcomeEmail(email, password, fullName);
      if (!emailResult.success) {
        log.warn('Failed to send welcome email', { email, error: emailResult.error });
      } else {
        log.info('Welcome email sent', { email });
        emailSent = true;
      }
    } else {
      log.info('Skipping welcome email (not requested)', { email });
    }

    log.info('Sales user created', { newUserId: salesUser.id, email });
    return NextResponse.json({ ...salesUser, emailSent }, { status: 201 });
  } catch (error) {
    log.error('Failed to create sales user', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to create sales user' },
      { status: 500 }
    );
  }
}
