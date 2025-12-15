import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { smsTriggers, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/triggers/[id] - Get a single trigger
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const [trigger] = await db
      .select()
      .from(smsTriggers)
      .where(eq(smsTriggers.id, id))
      .limit(1);

    if (!trigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    return NextResponse.json({ data: trigger });
  } catch (error) {
    console.error('[Triggers API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch trigger' },
      { status: 500 }
    );
  }
}

// PATCH /api/triggers/[id] - Update a trigger
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    // Check if trigger exists
    const [existingTrigger] = await db
      .select()
      .from(smsTriggers)
      .where(eq(smsTriggers.id, id))
      .limit(1);

    if (!existingTrigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    const { name, intentDescription, smsMessage, priority, isActive } = body;

    // Validate SMS message length if being updated
    if (smsMessage && smsMessage.length > 1600) {
      return NextResponse.json(
        { error: 'SMS message exceeds maximum length of 1600 characters' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Partial<typeof smsTriggers.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (intentDescription !== undefined) updateData.intentDescription = intentDescription.trim();
    if (smsMessage !== undefined) updateData.smsMessage = smsMessage.trim();
    if (priority !== undefined) updateData.priority = priority;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update trigger
    const [updatedTrigger] = await db
      .update(smsTriggers)
      .set(updateData)
      .where(eq(smsTriggers.id, id))
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'update',
      entityType: 'sms_trigger',
      entityId: id,
      details: {
        changes: body,
        previous: {
          name: existingTrigger.name,
          intentDescription: existingTrigger.intentDescription,
          smsMessage: existingTrigger.smsMessage,
          priority: existingTrigger.priority,
          isActive: existingTrigger.isActive,
        },
      },
    });

    return NextResponse.json({ data: updatedTrigger });
  } catch (error) {
    console.error('[Triggers API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update trigger' },
      { status: 500 }
    );
  }
}

// DELETE /api/triggers/[id] - Delete a trigger (hard delete since SMS triggers may need to be recreated)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Check if trigger exists
    const [existingTrigger] = await db
      .select()
      .from(smsTriggers)
      .where(eq(smsTriggers.id, id))
      .limit(1);

    if (!existingTrigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    // Hard delete the trigger
    await db.delete(smsTriggers).where(eq(smsTriggers.id, id));

    // Log the action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'delete',
      entityType: 'sms_trigger',
      entityId: id,
      details: {
        name: existingTrigger.name,
        campaignId: existingTrigger.campaignId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Triggers API] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete trigger' },
      { status: 500 }
    );
  }
}
