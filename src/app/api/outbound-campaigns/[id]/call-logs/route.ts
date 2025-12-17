import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { outboundCampaigns, outboundCallLogs, outboundContacts, users } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET - List call logs for a campaign
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

    // Get campaign
    const [campaign] = await db
      .select()
      .from(outboundCampaigns)
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

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const result = searchParams.get('result');
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(outboundCallLogs.campaignId, id)];

    if (result) {
      conditions.push(eq(outboundCallLogs.callResult, result as typeof outboundCallLogs.callResult.enumValues[number]));
    }

    // Get call logs with contact info
    const callLogs = await db
      .select({
        id: outboundCallLogs.id,
        contactId: outboundCallLogs.contactId,
        contactFirstName: outboundContacts.firstName,
        contactLastName: outboundContacts.lastName,
        contactPhoneNumber: outboundContacts.phoneNumber,
        vapiCallId: outboundCallLogs.vapiCallId,
        callResult: outboundCallLogs.callResult,
        durationSeconds: outboundCallLogs.durationSeconds,
        attemptNumber: outboundCallLogs.attemptNumber,
        transcript: outboundCallLogs.transcript,
        transcriptFormatted: outboundCallLogs.transcriptFormatted,
        recordingUrl: outboundCallLogs.recordingUrl,
        aiSummary: outboundCallLogs.aiSummary,
        smsSent: outboundCallLogs.smsSent,
        smsTriggerId: outboundCallLogs.smsTriggerId,
        startedAt: outboundCallLogs.startedAt,
        endedAt: outboundCallLogs.endedAt,
        createdAt: outboundCallLogs.createdAt,
      })
      .from(outboundCallLogs)
      .leftJoin(outboundContacts, eq(outboundCallLogs.contactId, outboundContacts.id))
      .where(and(...conditions))
      .orderBy(desc(outboundCallLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboundCallLogs)
      .where(and(...conditions));

    // Get stats by result
    const resultStats = await db
      .select({
        result: outboundCallLogs.callResult,
        count: sql<number>`count(*)::int`,
      })
      .from(outboundCallLogs)
      .where(eq(outboundCallLogs.campaignId, id))
      .groupBy(outboundCallLogs.callResult);

    return NextResponse.json({
      callLogs,
      stats: resultStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching call logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call logs' },
      { status: 500 }
    );
  }
}
