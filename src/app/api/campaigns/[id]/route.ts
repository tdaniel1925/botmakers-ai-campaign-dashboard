import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { campaigns, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin, requireFullAuth } from '@/lib/auth';

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  twilioPhoneNumber: z.string().optional(),
  twilioOverride: z.boolean().optional(),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  aiExtractionHints: z.record(z.string(), z.string()).optional(),
  isActive: z.boolean().optional(),
});

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET - Get single campaign
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireFullAuth();
    const { id } = await params;

    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, id),
      with: {
        organization: true,
        smsTriggers: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Client users can only view their organization's campaigns
    if (user.role === 'client_user' && campaign.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Generate webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const campaignWithUrl = {
      ...campaign,
      webhookUrl: `${baseUrl}/api/webhook/${campaign.webhookUuid}`,
      // Don't expose Twilio auth token
      twilioAuthToken: campaign.twilioAuthToken ? '••••••••' : null,
    };

    return NextResponse.json({ data: campaignWithUrl });
  } catch (error) {
    console.error('GET /api/campaigns/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update campaign
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAdmin();
    const { id } = await params;

    const body = await req.json();
    const result = updateCampaignSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Check if campaign exists
    const [existing] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Build update data with proper typing
    const updateData: Partial<typeof campaigns.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (result.data.name !== undefined) updateData.name = result.data.name;
    if (result.data.description !== undefined) updateData.description = result.data.description;
    if (result.data.twilioPhoneNumber !== undefined) updateData.twilioPhoneNumber = result.data.twilioPhoneNumber;
    if (result.data.twilioOverride !== undefined) updateData.twilioOverride = result.data.twilioOverride;
    if (result.data.twilioAccountSid !== undefined) updateData.twilioAccountSid = result.data.twilioAccountSid;
    if (result.data.twilioAuthToken !== undefined) updateData.twilioAuthToken = result.data.twilioAuthToken;
    if (result.data.aiExtractionHints !== undefined) updateData.aiExtractionHints = result.data.aiExtractionHints as Record<string, string>;
    if (result.data.isActive !== undefined) updateData.isActive = result.data.isActive;

    // Update campaign
    const [updated] = await db
      .update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, id))
      .returning();

    // Create audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'update',
      entityType: 'campaign',
      entityId: id,
      details: result.data,
    });

    // Generate webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const campaignWithUrl = {
      ...updated,
      webhookUrl: `${baseUrl}/api/webhook/${updated.webhookUuid}`,
      twilioAuthToken: updated.twilioAuthToken ? '••••••••' : null,
    };

    return NextResponse.json({ data: campaignWithUrl });
  } catch (error) {
    console.error('PATCH /api/campaigns/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete (archive) campaign
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAdmin();
    const { id } = await params;

    // Check if campaign exists
    const [existing] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Soft delete
    await db
      .update(campaigns)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id));

    // Create audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'delete',
      entityType: 'campaign',
      entityId: id,
      details: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/campaigns/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
