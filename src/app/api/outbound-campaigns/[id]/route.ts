import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import {
  outboundCampaigns,
  outboundSchedules,
  outboundContacts,
  outboundCallLogs,
  users,
  organizations,
} from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET - Get single outbound campaign with details
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get campaign with organization
    const [campaign] = await db
      .select({
        id: outboundCampaigns.id,
        organizationId: outboundCampaigns.organizationId,
        organizationName: organizations.name,
        name: outboundCampaigns.name,
        description: outboundCampaigns.description,
        webhookUuid: outboundCampaigns.webhookUuid,
        status: outboundCampaigns.status,
        vapiAssistantId: outboundCampaigns.vapiAssistantId,
        vapiPhoneNumberId: outboundCampaigns.vapiPhoneNumberId,
        vapiPhoneNumber: outboundCampaigns.vapiPhoneNumber,
        twilioPhoneNumber: outboundCampaigns.twilioPhoneNumber,
        maxConcurrentCalls: outboundCampaigns.maxConcurrentCalls,
        maxRetries: outboundCampaigns.maxRetries,
        retryDelayHours: outboundCampaigns.retryDelayHours,
        aiExtractionHints: outboundCampaigns.aiExtractionHints,
        totalContacts: outboundCampaigns.totalContacts,
        contactsCalled: outboundCampaigns.contactsCalled,
        contactsAnswered: outboundCampaigns.contactsAnswered,
        contactsFailed: outboundCampaigns.contactsFailed,
        currentStep: outboundCampaigns.currentStep,
        isWizardComplete: outboundCampaigns.isWizardComplete,
        actualStartAt: outboundCampaigns.actualStartAt,
        completedAt: outboundCampaigns.completedAt,
        scheduledStartAt: outboundCampaigns.scheduledStartAt,
        createdAt: outboundCampaigns.createdAt,
        updatedAt: outboundCampaigns.updatedAt,
      })
      .from(outboundCampaigns)
      .leftJoin(organizations, eq(outboundCampaigns.organizationId, organizations.id))
      .where(eq(outboundCampaigns.id, id))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check access for client users
    if (
      dbUser.role === 'client_user' &&
      dbUser.organizationId !== campaign.organizationId
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get schedules
    const schedules = await db
      .select()
      .from(outboundSchedules)
      .where(eq(outboundSchedules.campaignId, id));

    // Get contact counts by status
    const contactStats = await db
      .select({
        status: outboundContacts.status,
        count: count(),
      })
      .from(outboundContacts)
      .where(eq(outboundContacts.campaignId, id))
      .groupBy(outboundContacts.status);

    return NextResponse.json({
      campaign,
      schedules,
      contactStats,
    });
  } catch (error) {
    console.error('Error fetching outbound campaign:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    );
  }
}

// PATCH - Update outbound campaign
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and verify admin
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!dbUser || dbUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get campaign
    const [existing] = await db
      .select()
      .from(outboundCampaigns)
      .where(eq(outboundCampaigns.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const body = await req.json();

    // Build update object
    const updates: Partial<typeof outboundCampaigns.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Step 1: Basic info
    if (body.name !== undefined) updates.name = body.name?.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;

    // Step 2/3: VAPI config
    if (body.vapiAssistantId !== undefined) updates.vapiAssistantId = body.vapiAssistantId;
    if (body.vapiPhoneNumberId !== undefined) updates.vapiPhoneNumberId = body.vapiPhoneNumberId;
    if (body.vapiPhoneNumber !== undefined) updates.vapiPhoneNumber = body.vapiPhoneNumber;

    // Step 5: Call settings
    if (body.maxConcurrentCalls !== undefined) updates.maxConcurrentCalls = body.maxConcurrentCalls;
    if (body.maxRetries !== undefined) updates.maxRetries = body.maxRetries;
    if (body.retryDelayHours !== undefined) updates.retryDelayHours = body.retryDelayHours;

    // Step 6: SMS/Twilio
    if (body.twilioPhoneNumber !== undefined) updates.twilioPhoneNumber = body.twilioPhoneNumber;
    if (body.aiExtractionHints !== undefined) updates.aiExtractionHints = body.aiExtractionHints;

    // Wizard progress
    if (body.currentStep !== undefined) updates.currentStep = body.currentStep;
    if (body.isWizardComplete !== undefined) updates.isWizardComplete = body.isWizardComplete;

    // Status changes
    if (body.status !== undefined) {
      const validTransitions: Record<string, string[]> = {
        draft: ['scheduled', 'cancelled'],
        scheduled: ['running', 'cancelled', 'draft'],
        running: ['paused', 'completed', 'cancelled'],
        paused: ['running', 'cancelled'],
        completed: [],
        cancelled: ['draft'],
      };

      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${existing.status} to ${body.status}`,
          },
          { status: 400 }
        );
      }

      updates.status = body.status;

      if (body.status === 'running' && !existing.actualStartAt) {
        updates.actualStartAt = new Date();
      }

      if (body.status === 'completed') {
        updates.completedAt = new Date();
      }
    }

    const [updated] = await db
      .update(outboundCampaigns)
      .set(updates)
      .where(eq(outboundCampaigns.id, id))
      .returning();

    return NextResponse.json({ campaign: updated });
  } catch (error) {
    console.error('Error updating outbound campaign:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    );
  }
}

// DELETE - Delete outbound campaign
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and verify admin
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!dbUser || dbUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get campaign
    const [existing] = await db
      .select()
      .from(outboundCampaigns)
      .where(eq(outboundCampaigns.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Only allow deletion of draft or cancelled campaigns
    if (!['draft', 'cancelled'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Can only delete draft or cancelled campaigns' },
        { status: 400 }
      );
    }

    // Delete related data first (cascade)
    await db
      .delete(outboundCallLogs)
      .where(eq(outboundCallLogs.campaignId, id));

    await db
      .delete(outboundContacts)
      .where(eq(outboundContacts.campaignId, id));

    await db
      .delete(outboundSchedules)
      .where(eq(outboundSchedules.campaignId, id));

    await db
      .delete(outboundCampaigns)
      .where(eq(outboundCampaigns.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting outbound campaign:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}
