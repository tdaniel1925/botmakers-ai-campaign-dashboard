import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { leads, leadActivities } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createActivitySchema, validateRequest } from '@/lib/validations/sales';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/sales/leads/[id]/activities');

  try {
    const salesUser = await requireSalesAuth();
    const { id: leadId } = await params;

    // Validate UUID format
    if (!leadId.match(/^[0-9a-f-]{36}$/i)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    log.info('Fetching activities', { userId: salesUser.id, leadId });

    // Rate limiting
    const rateLimit = withRateLimit(salesUser.id, 'sales-activities-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    // Verify lead belongs to this sales user
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.salesUserId, salesUser.id)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Get activities
    const activities = await db
      .select()
      .from(leadActivities)
      .where(eq(leadActivities.leadId, leadId))
      .orderBy(desc(leadActivities.createdAt));

    log.info('Activities fetched', { userId: salesUser.id, leadId, count: activities.length });

    const response = NextResponse.json(activities);
    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to fetch activities', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/sales/leads/[id]/activities');

  try {
    const salesUser = await requireSalesAuth();
    const { id: leadId } = await params;

    // Validate UUID format
    if (!leadId.match(/^[0-9a-f-]{36}$/i)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    log.info('Creating activity', { userId: salesUser.id, leadId });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(salesUser.id, 'sales-activities-post', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(createActivitySchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { userId: salesUser.id, errors: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    // Verify lead belongs to this sales user
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.salesUserId, salesUser.id)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const { activityType, title, description, metadata } = validation.data;

    const [activity] = await db
      .insert(leadActivities)
      .values({
        leadId,
        activityType,
        title,
        description: description || null,
        metadata: metadata || null,
        userId: salesUser.id,
        userType: 'sales',
      })
      .returning();

    log.info('Activity created', { userId: salesUser.id, leadId, activityId: activity.id });

    const response = NextResponse.json(activity, { status: 201 });
    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to create activity', error);
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}
