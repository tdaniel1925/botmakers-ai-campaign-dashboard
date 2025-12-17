import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leads, leadActivities, nurtureEnrollments } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireSalesAuth } from '@/lib/auth';
import { updateLeadSchema, validateRequest } from '@/lib/validations/sales';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sales/leads/[id] - Get a single lead
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = createApiLogger('/api/sales/leads/[id]');

  try {
    const salesUser = await requireSalesAuth();
    const isObserver = salesUser.accessType !== 'sales_user';
    const { id } = await params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f-]{36}$/i)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    log.info('Fetching lead', { userId: salesUser.id, leadId: id, isObserver });

    // Rate limiting
    const rateLimit = withRateLimit(salesUser.id, 'sales-lead-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    // Observers (admins) can view any lead, sales users can only view their own
    const whereCondition = isObserver
      ? eq(leads.id, id)
      : and(eq(leads.id, id), eq(leads.salesUserId, salesUser.id));

    const lead = await db.query.leads.findFirst({
      where: whereCondition,
      with: {
        stage: true,
        activities: {
          orderBy: [desc(leadActivities.createdAt)],
          limit: 50,
        },
        nurtureEnrollments: {
          with: {
            campaign: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    log.info('Lead fetched', { userId: salesUser.id, leadId: id, isObserver });

    const response = NextResponse.json({ ...lead, isObserver });
    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to fetch lead', error);
    return NextResponse.json(
      { error: 'Failed to fetch lead' },
      { status: 500 }
    );
  }
}

// PUT /api/sales/leads/[id] - Update a lead (limited fields for sales)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const log = createApiLogger('/api/sales/leads/[id]');

  try {
    const salesUser = await requireSalesAuth();
    const { id } = await params;

    // Only sales_user can update leads - observers cannot
    if (salesUser.accessType !== 'sales_user') {
      log.info('Lead update rejected - user is observer', { userId: salesUser.id, accessType: salesUser.accessType });
      return NextResponse.json(
        { error: 'Only sales team members can update leads' },
        { status: 403 }
      );
    }

    // Validate UUID format
    if (!id.match(/^[0-9a-f-]{36}$/i)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    log.info('Updating lead', { userId: salesUser.id, leadId: id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(salesUser.id, 'sales-lead-put', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(updateLeadSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { userId: salesUser.id, errors: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    // Check that lead belongs to this sales user
    const existingLead = await db.query.leads.findFirst({
      where: and(
        eq(leads.id, id),
        eq(leads.salesUserId, salesUser.id)
      ),
    });

    if (!existingLead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      estimatedValue,
      source,
      notes,
      nextFollowUpAt,
    } = validation.data;

    // Sales users can only update certain fields (not status or stage - admin only)
    const [updatedLead] = await db
      .update(leads)
      .set({
        firstName: firstName ?? existingLead.firstName,
        lastName: lastName ?? existingLead.lastName,
        email: email !== undefined ? email : existingLead.email,
        phone: phone !== undefined ? phone : existingLead.phone,
        company: company !== undefined ? company : existingLead.company,
        jobTitle: jobTitle !== undefined ? jobTitle : existingLead.jobTitle,
        estimatedValue: estimatedValue !== undefined ? estimatedValue : existingLead.estimatedValue,
        source: source !== undefined ? source : existingLead.source,
        notes: notes !== undefined ? notes : existingLead.notes,
        nextFollowUpAt: nextFollowUpAt !== undefined ? (nextFollowUpAt ? new Date(nextFollowUpAt) : null) : existingLead.nextFollowUpAt,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id))
      .returning();

    // Log activity if notes changed
    if (notes && notes !== existingLead.notes) {
      await db.insert(leadActivities).values({
        leadId: id,
        userId: salesUser.id,
        userType: 'sales',
        activityType: 'note',
        title: 'Notes updated',
        description: notes,
      });
    }

    // Fetch updated lead with relations
    const leadWithRelations = await db.query.leads.findFirst({
      where: eq(leads.id, id),
      with: {
        stage: true,
      },
    });

    log.info('Lead updated', { userId: salesUser.id, leadId: id });

    const response = NextResponse.json(leadWithRelations);
    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to update lead', error);
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}

// DELETE /api/sales/leads/[id] - Delete a lead (sales users only, their own leads)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = createApiLogger('/api/sales/leads/[id]');

  try {
    const salesUser = await requireSalesAuth();
    const { id } = await params;

    // Only sales_user can delete leads - observers cannot
    if (salesUser.accessType !== 'sales_user') {
      log.info('Lead deletion rejected - user is observer', { userId: salesUser.id, accessType: salesUser.accessType });
      return NextResponse.json(
        { error: 'Only sales team members can delete leads' },
        { status: 403 }
      );
    }

    // Validate UUID format
    if (!id.match(/^[0-9a-f-]{36}$/i)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    log.info('Deleting lead', { userId: salesUser.id, leadId: id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(salesUser.id, 'sales-lead-delete', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    // Check that lead belongs to this sales user
    const existingLead = await db.query.leads.findFirst({
      where: and(
        eq(leads.id, id),
        eq(leads.salesUserId, salesUser.id)
      ),
    });

    if (!existingLead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Delete related records first (activities, nurture enrollments)
    await db.delete(leadActivities).where(eq(leadActivities.leadId, id));
    await db.delete(nurtureEnrollments).where(eq(nurtureEnrollments.leadId, id));

    // Delete the lead
    await db.delete(leads).where(eq(leads.id, id));

    log.info('Lead deleted', { userId: salesUser.id, leadId: id });

    const response = NextResponse.json({ success: true, message: 'Lead deleted successfully' });
    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to delete lead', error);
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
