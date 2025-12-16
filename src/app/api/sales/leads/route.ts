import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leads, leadActivities, leadStages } from '@/db/schema';
import { eq, and, sql, desc, ilike, or } from 'drizzle-orm';
import { requireSalesAuth } from '@/lib/auth';
import { createLeadSchema, validateRequest } from '@/lib/validations/sales';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';

// Sanitize search input to prevent potential abuse
function sanitizeSearchInput(input: string): string {
  // Remove special SQL-like characters and limit length
  return input
    .replace(/[%_\\]/g, '') // Remove LIKE wildcards
    .replace(/[<>'"`;]/g, '') // Remove potential injection chars
    .trim()
    .slice(0, 200); // Limit length
}

// GET /api/sales/leads - Get leads for current sales user (or all leads for admins)
export async function GET(request: NextRequest) {
  const log = createApiLogger('/api/sales/leads');

  try {
    const salesUser = await requireSalesAuth();
    const isObserver = salesUser.accessType !== 'sales_user';
    log.info('Fetching leads', { userId: salesUser.id, accessType: salesUser.accessType, isObserver });

    // Rate limiting
    const rateLimit = withRateLimit(salesUser.id, 'sales-leads-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: salesUser.id });
      return rateLimit.response;
    }

    const searchParams = request.nextUrl.searchParams;

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const rawSearch = searchParams.get('search') || '';
    const search = sanitizeSearchInput(rawSearch);
    const status = searchParams.get('status') || '';
    const stageId = searchParams.get('stageId') || '';

    const offset = (page - 1) * limit;

    // Build conditions - admins see all leads, sales users see only their own
    const conditions: ReturnType<typeof eq>[] = [];

    if (!isObserver) {
      conditions.push(eq(leads.salesUserId, salesUser.id));
    }

    if (search) {
      conditions.push(
        or(
          ilike(leads.firstName, `%${search}%`),
          ilike(leads.lastName, `%${search}%`),
          ilike(leads.email, `%${search}%`),
          ilike(leads.phone, `%${search}%`),
          ilike(leads.company, `%${search}%`)
        )!
      );
    }

    if (status && ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].includes(status)) {
      conditions.push(eq(leads.status, status as 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'));
    }

    if (stageId && stageId.match(/^[0-9a-f-]{36}$/i)) {
      conditions.push(eq(leads.stageId, stageId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get leads with stage info
    const [leadsList, totalResult] = await Promise.all([
      db.query.leads.findMany({
        where: whereClause,
        with: {
          stage: true,
        },
        orderBy: [desc(leads.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(whereClause),
    ]);

    log.info('Leads fetched successfully', {
      userId: salesUser.id,
      count: leadsList.length,
      total: totalResult[0].count,
      isObserver,
    });

    const response = NextResponse.json({
      leads: leadsList,
      pagination: {
        page,
        limit,
        total: Number(totalResult[0].count),
        totalPages: Math.ceil(Number(totalResult[0].count) / limit),
      },
      isObserver,
    });

    // Add rate limit headers
    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to fetch leads', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

// POST /api/sales/leads - Create a new lead
export async function POST(request: NextRequest) {
  const log = createApiLogger('/api/sales/leads');

  try {
    const salesUser = await requireSalesAuth();
    log.info('Creating lead', { userId: salesUser.id, accessType: salesUser.accessType });

    // Admins and users_with_access cannot create leads - they're observers
    if (salesUser.accessType !== 'sales_user') {
      log.info('Lead creation rejected - user is not a sales_user', { accessType: salesUser.accessType });
      return NextResponse.json(
        { error: 'Only sales team members can create leads' },
        { status: 403 }
      );
    }

    // Rate limiting for write operations
    const rateLimit = withRateLimit(salesUser.id, 'sales-leads-post', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: salesUser.id });
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(createLeadSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { userId: salesUser.id, errors: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { firstName, lastName, email, phone, company, jobTitle, estimatedValue, source, notes } = validation.data;

    // Get default stage (first one by order)
    const [defaultStage] = await db
      .select()
      .from(leadStages)
      .where(eq(leadStages.isDefault, true))
      .limit(1);

    // If no default stage, get the first one
    let stageId = defaultStage?.id;
    if (!stageId) {
      const [firstStage] = await db
        .select()
        .from(leadStages)
        .orderBy(leadStages.order)
        .limit(1);
      stageId = firstStage?.id;
    }

    // Create the lead
    const [newLead] = await db
      .insert(leads)
      .values({
        salesUserId: salesUser.id,
        stageId,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        company: company || null,
        jobTitle: jobTitle || null,
        estimatedValue: estimatedValue || null,
        source: source || null,
        notes: notes || null,
        status: 'new',
      })
      .returning();

    // Log the activity
    await db.insert(leadActivities).values({
      leadId: newLead.id,
      userId: salesUser.id,
      userType: 'sales',
      activityType: 'note',
      title: 'Lead created',
      description: `New lead created by ${salesUser.fullName}`,
    });

    // Fetch the lead with stage info
    const leadWithStage = await db.query.leads.findFirst({
      where: eq(leads.id, newLead.id),
      with: {
        stage: true,
      },
    });

    log.info('Lead created successfully', { userId: salesUser.id, leadId: newLead.id });

    const response = NextResponse.json(leadWithStage, { status: 201 });
    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to create lead', error);
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    );
  }
}
