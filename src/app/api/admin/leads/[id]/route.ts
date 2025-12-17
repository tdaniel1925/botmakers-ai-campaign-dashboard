import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { leads, leadActivities, leadStages, commissions, salesUsers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { adminUpdateLeadSchema, validateRequest, uuidSchema } from '@/lib/validations/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/admin/leads/[id]');
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Validate UUID format
    if (!uuidSchema.safeParse(id).success) {
      log.warn('Invalid UUID format', { id });
      return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 });
    }

    log.info('Fetching lead', { userId: admin.id, leadId: id });

    // Rate limiting
    const rateLimit = withRateLimit(admin.id, 'admin-lead-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const [lead] = await db
      .select({
        id: leads.id,
        leadNumber: leads.leadNumber,
        firstName: leads.firstName,
        lastName: leads.lastName,
        company: leads.company,
        email: leads.email,
        phone: leads.phone,
        jobTitle: leads.jobTitle,
        status: leads.status,
        stageId: leads.stageId,
        source: leads.source,
        estimatedValue: leads.estimatedValue,
        notes: leads.notes,
        nextFollowUpAt: leads.nextFollowUpAt,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
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
      .where(eq(leads.id, id))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Get activities
    const activities = await db
      .select()
      .from(leadActivities)
      .where(eq(leadActivities.leadId, id))
      .orderBy(desc(leadActivities.createdAt))
      .limit(50);

    // Get stages for dropdown
    const stages = await db
      .select()
      .from(leadStages)
      .where(eq(leadStages.isActive, true))
      .orderBy(leadStages.order);

    log.info('Lead fetched', { leadId: id });
    return NextResponse.json({ lead, activities, stages });
  } catch (error) {
    log.error('Failed to fetch lead', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to fetch lead' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/admin/leads/[id]');
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Validate UUID format
    if (!uuidSchema.safeParse(id).success) {
      log.warn('Invalid UUID format', { id });
      return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 });
    }

    log.info('Updating lead', { userId: admin.id, leadId: id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-lead-put', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(adminUpdateLeadSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { details: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const [existingLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);

    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const {
      firstName,
      lastName,
      company,
      email,
      phone,
      jobTitle,
      status,
      stageId,
      source,
      estimatedValue,
      notes,
      nextFollowUpAt,
    } = validation.data;

    // Track stage change
    const stageChanged = stageId !== undefined && stageId !== existingLead.stageId;
    const statusChanged = status !== undefined && status !== existingLead.status;

    // Update lead
    const [updated] = await db
      .update(leads)
      .set({
        firstName: firstName !== undefined ? firstName : existingLead.firstName,
        lastName: lastName !== undefined ? lastName : existingLead.lastName,
        company: company !== undefined ? company : existingLead.company,
        email: email !== undefined ? email : existingLead.email,
        phone: phone !== undefined ? phone : existingLead.phone,
        jobTitle: jobTitle !== undefined ? jobTitle : existingLead.jobTitle,
        status: status !== undefined ? status : existingLead.status,
        stageId: stageId !== undefined ? stageId : existingLead.stageId,
        source: source !== undefined ? source : existingLead.source,
        estimatedValue: estimatedValue !== undefined ? estimatedValue : existingLead.estimatedValue,
        notes: notes !== undefined ? notes : existingLead.notes,
        nextFollowUpAt: nextFollowUpAt !== undefined
          ? nextFollowUpAt ? new Date(nextFollowUpAt) : null
          : existingLead.nextFollowUpAt,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id))
      .returning();

    // Log stage change activity
    if (stageChanged) {
      let stageName = 'Unassigned';
      if (stageId) {
        const [stage] = await db
          .select({ name: leadStages.name })
          .from(leadStages)
          .where(eq(leadStages.id, stageId))
          .limit(1);
        if (stage) stageName = stage.name;
      }

      await db.insert(leadActivities).values({
        leadId: id,
        userId: admin.id,
        userType: 'admin',
        activityType: 'stage_change',
        title: `Stage changed to ${stageName}`,
        description: `Lead moved to ${stageName} by administrator`,
        metadata: { newStageId: stageId, newStageName: stageName },
      });
    }

    // Log status change activity
    if (statusChanged) {
      await db.insert(leadActivities).values({
        leadId: id,
        userId: admin.id,
        userType: 'admin',
        activityType: 'status_change',
        title: `Status changed to ${status}`,
        description: `Lead status updated to ${status} by administrator`,
        metadata: { newStatus: status, oldStatus: existingLead.status },
      });

      // If status changed to 'won', notify admin that commission can be created
      if (status === 'won' && existingLead.estimatedValue) {
        await db.insert(leadActivities).values({
          leadId: id,
          userId: admin.id,
          userType: 'admin',
          activityType: 'note',
          title: 'Lead marked as won - Commission pending',
          description: 'This lead is eligible for commission. Go to Commissions to create and approve the commission.',
          metadata: { estimatedValue: existingLead.estimatedValue },
        });
      }
    }

    log.info('Lead updated', { leadId: id, stageChanged, statusChanged });
    return NextResponse.json(updated);
  } catch (error) {
    log.error('Failed to update lead', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}
