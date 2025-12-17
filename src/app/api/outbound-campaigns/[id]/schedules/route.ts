import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { outboundCampaigns, outboundSchedules, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET - List schedules for a campaign
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

    const schedules = await db
      .select()
      .from(outboundSchedules)
      .where(eq(outboundSchedules.campaignId, id))
      .orderBy(outboundSchedules.dayOfWeek, outboundSchedules.startTime);

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

// POST - Set schedules for a campaign (replaces all existing)
export async function POST(req: NextRequest, { params }: RouteParams) {
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
    const [campaign] = await db
      .select()
      .from(outboundCampaigns)
      .where(eq(outboundCampaigns.id, id))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Only allow modifying draft campaigns
    if (campaign.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only modify schedules for draft campaigns' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { schedules } = body;

    if (!Array.isArray(schedules)) {
      return NextResponse.json(
        { error: 'Schedules array is required' },
        { status: 400 }
      );
    }

    // Validate schedules
    for (const schedule of schedules) {
      if (
        typeof schedule.dayOfWeek !== 'number' ||
        schedule.dayOfWeek < 0 ||
        schedule.dayOfWeek > 6
      ) {
        return NextResponse.json(
          { error: 'Invalid day of week (must be 0-6)' },
          { status: 400 }
        );
      }

      if (
        typeof schedule.startTime !== 'string' ||
        !/^\d{2}:\d{2}$/.test(schedule.startTime)
      ) {
        return NextResponse.json(
          { error: 'Invalid start time format (must be HH:MM)' },
          { status: 400 }
        );
      }

      if (
        typeof schedule.endTime !== 'string' ||
        !/^\d{2}:\d{2}$/.test(schedule.endTime)
      ) {
        return NextResponse.json(
          { error: 'Invalid end time format (must be HH:MM)' },
          { status: 400 }
        );
      }

      if (!schedule.timezone || typeof schedule.timezone !== 'string') {
        return NextResponse.json(
          { error: 'Timezone is required for each schedule' },
          { status: 400 }
        );
      }
    }

    // Delete existing schedules
    await db
      .delete(outboundSchedules)
      .where(eq(outboundSchedules.campaignId, id));

    // Insert new schedules
    if (schedules.length > 0) {
      const scheduleValues = schedules.map((s: { dayOfWeek: number; startTime: string; endTime: string; timezone: string; isEnabled?: boolean }) => ({
        campaignId: id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        timezone: s.timezone,
        isEnabled: s.isEnabled ?? true,
      }));

      await db.insert(outboundSchedules).values(scheduleValues);
    }

    // Fetch updated schedules
    const updatedSchedules = await db
      .select()
      .from(outboundSchedules)
      .where(eq(outboundSchedules.campaignId, id))
      .orderBy(outboundSchedules.dayOfWeek, outboundSchedules.startTime);

    return NextResponse.json({ schedules: updatedSchedules });
  } catch (error) {
    console.error('Error setting schedules:', error);
    return NextResponse.json(
      { error: 'Failed to set schedules' },
      { status: 500 }
    );
  }
}
