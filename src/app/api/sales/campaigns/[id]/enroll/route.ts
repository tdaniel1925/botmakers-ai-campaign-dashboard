import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { campaigns, leads, nurtureEnrollments, leadActivities } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { enrollLeadsSchema, validateRequest } from '@/lib/validations/sales';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/sales/campaigns/[id]/enroll');

  try {
    const salesUser = await requireSalesAuth();
    const { id: campaignId } = await params;

    // Validate UUID format
    if (!campaignId.match(/^[0-9a-f-]{36}$/i)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }

    log.info('Fetching enrollment data', { userId: salesUser.id, campaignId });

    // Rate limiting
    const rateLimit = withRateLimit(salesUser.id, 'sales-enroll-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    // Verify campaign exists and is active
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get this sales user's leads and their enrollment status for this campaign
    const salesUserLeads = await db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        company: leads.company,
        email: leads.email,
        status: leads.status,
      })
      .from(leads)
      .where(eq(leads.salesUserId, salesUser.id));

    const leadIds = salesUserLeads.map((l) => l.id);

    // Get existing enrollments
    let enrolledLeadIds: Set<string> = new Set();
    if (leadIds.length > 0) {
      const enrollments = await db
        .select({ leadId: nurtureEnrollments.leadId })
        .from(nurtureEnrollments)
        .where(
          and(
            eq(nurtureEnrollments.campaignId, campaignId),
            inArray(nurtureEnrollments.leadId, leadIds)
          )
        );
      enrolledLeadIds = new Set(enrollments.map((e) => e.leadId));
    }

    const leadsWithEnrollment = salesUserLeads.map((lead) => ({
      ...lead,
      isEnrolled: enrolledLeadIds.has(lead.id),
    }));

    log.info('Enrollment data fetched', { userId: salesUser.id, campaignId, leadCount: leadsWithEnrollment.length });

    const response = NextResponse.json({
      campaign,
      leads: leadsWithEnrollment,
    });

    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to fetch enrollment data', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrollment data' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/sales/campaigns/[id]/enroll');

  try {
    const salesUser = await requireSalesAuth();
    const { id: campaignId } = await params;

    // Validate UUID format
    if (!campaignId.match(/^[0-9a-f-]{36}$/i)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }

    log.info('Enrolling leads in campaign', { userId: salesUser.id, campaignId });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(salesUser.id, 'sales-enroll-post', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(enrollLeadsSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { userId: salesUser.id, errors: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { leadIds } = validation.data;

    // Verify campaign exists and is active
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.isActive, true)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found or not active' },
        { status: 404 }
      );
    }

    // Verify all leads belong to this sales user
    const salesUserLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.salesUserId, salesUser.id),
          inArray(leads.id, leadIds)
        )
      );

    const validLeadIds = salesUserLeads.map((l) => l.id);

    if (validLeadIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid leads found' },
        { status: 400 }
      );
    }

    // Check existing enrollments
    const existingEnrollments = await db
      .select({ leadId: nurtureEnrollments.leadId })
      .from(nurtureEnrollments)
      .where(
        and(
          eq(nurtureEnrollments.campaignId, campaignId),
          inArray(nurtureEnrollments.leadId, validLeadIds)
        )
      );

    const alreadyEnrolledIds = new Set(existingEnrollments.map((e) => e.leadId));
    const newLeadIds = validLeadIds.filter((id) => !alreadyEnrolledIds.has(id));

    if (newLeadIds.length === 0) {
      return NextResponse.json(
        { message: 'All selected leads are already enrolled' },
        { status: 200 }
      );
    }

    // Create enrollments
    const enrollmentValues = newLeadIds.map((leadId) => ({
      leadId,
      campaignId,
      salesUserId: salesUser.id,
      isActive: true,
    }));

    await db.insert(nurtureEnrollments).values(enrollmentValues);

    // Log activities
    const activityValues = newLeadIds.map((leadId) => ({
      leadId,
      activityType: 'campaign_enrollment',
      title: `Enrolled in campaign: ${campaign.name}`,
      description: `Lead enrolled in nurture campaign by sales representative`,
      userId: salesUser.id,
      userType: 'sales',
      metadata: { campaignId, campaignName: campaign.name },
    }));

    await db.insert(leadActivities).values(activityValues);

    log.info('Leads enrolled', { userId: salesUser.id, campaignId, enrolledCount: newLeadIds.length });

    const response = NextResponse.json({
      message: `Successfully enrolled ${newLeadIds.length} lead(s)`,
      enrolledCount: newLeadIds.length,
      alreadyEnrolledCount: alreadyEnrolledIds.size,
    });

    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to enroll leads', error);
    return NextResponse.json(
      { error: 'Failed to enroll leads' },
      { status: 500 }
    );
  }
}
