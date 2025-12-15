import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { interactions, campaigns, auditLogs, smsLogs } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireFullAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/interactions/[id] - Get a single interaction with full details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireFullAuth();
    const { id } = await params;

    // Get the interaction with related data
    const [interaction] = await db.query.interactions.findMany({
      where: eq(interactions.id, id),
      with: {
        campaign: {
          with: {
            organization: true,
          },
        },
        contact: true,
        smsLogs: {
          with: {
            trigger: true,
          },
        },
      },
    });

    if (!interaction) {
      return NextResponse.json({ error: 'Interaction not found' }, { status: 404 });
    }

    // Check access for client users
    if (user.role === 'client_user') {
      if (interaction.campaign.organizationId !== user.organizationId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json({ data: interaction });
  } catch (error) {
    console.error('[Interactions API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch interaction' },
      { status: 500 }
    );
  }
}

// PATCH /api/interactions/[id] - Update interaction (flag, tags, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireFullAuth();
    const { id } = await params;
    const body = await request.json();

    // Get the interaction
    const [existingInteraction] = await db.query.interactions.findMany({
      where: eq(interactions.id, id),
      with: {
        campaign: true,
      },
    });

    if (!existingInteraction) {
      return NextResponse.json({ error: 'Interaction not found' }, { status: 404 });
    }

    // Check access for client users
    if (user.role === 'client_user') {
      if (existingInteraction.campaign.organizationId !== user.organizationId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const { flagged, tags } = body;

    // Build update object
    const updateData: Partial<typeof interactions.$inferInsert> = {};

    if (flagged !== undefined) updateData.flagged = flagged;
    if (tags !== undefined) updateData.tags = tags;

    // Update interaction
    const [updated] = await db
      .update(interactions)
      .set(updateData)
      .where(eq(interactions.id, id))
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'update',
      entityType: 'interaction',
      entityId: id,
      details: {
        changes: body,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[Interactions API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update interaction' },
      { status: 500 }
    );
  }
}
