import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { smsTriggers, campaigns, auditLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/campaigns/[id]/triggers - List triggers for a campaign
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Verify campaign exists
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const triggers = await db
      .select()
      .from(smsTriggers)
      .where(
        and(
          eq(smsTriggers.campaignId, id),
          includeInactive ? undefined : eq(smsTriggers.isActive, true)
        )
      )
      .orderBy(smsTriggers.priority, desc(smsTriggers.createdAt));

    return NextResponse.json({ data: triggers });
  } catch (error) {
    console.error('[SMS Triggers API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch triggers' },
      { status: 500 }
    );
  }
}

// POST /api/campaigns/[id]/triggers - Create a new trigger
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const { name, intentDescription, smsMessage, priority } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Trigger name is required' }, { status: 400 });
    }
    if (!intentDescription?.trim()) {
      return NextResponse.json({ error: 'Intent description is required' }, { status: 400 });
    }
    if (!smsMessage?.trim()) {
      return NextResponse.json({ error: 'SMS message is required' }, { status: 400 });
    }

    // Validate SMS message length (160 chars recommended, warn at 300+)
    if (smsMessage.length > 1600) {
      return NextResponse.json(
        { error: 'SMS message exceeds maximum length of 1600 characters' },
        { status: 400 }
      );
    }

    // Verify campaign exists
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Create trigger
    const [newTrigger] = await db
      .insert(smsTriggers)
      .values({
        campaignId: id,
        name: name.trim(),
        intentDescription: intentDescription.trim(),
        smsMessage: smsMessage.trim(),
        priority: priority || 100,
        isActive: true,
      })
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'create',
      entityType: 'sms_trigger',
      entityId: newTrigger.id,
      details: {
        campaignId: id,
        name,
        intentDescription,
        priority,
      },
    });

    return NextResponse.json({ data: newTrigger }, { status: 201 });
  } catch (error) {
    console.error('[SMS Triggers API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create trigger' },
      { status: 500 }
    );
  }
}
