import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { outboundCampaigns, outboundContacts, users } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET - List contacts for a campaign
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
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions = [eq(outboundContacts.campaignId, id)];

    if (status) {
      conditions.push(eq(outboundContacts.status, status as typeof outboundContacts.status.enumValues[number]));
    }

    // Get contacts
    const contacts = await db
      .select()
      .from(outboundContacts)
      .where(and(...conditions))
      .orderBy(desc(outboundContacts.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboundContacts)
      .where(and(...conditions));

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

// POST - Add contacts to campaign (from parsed upload)
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

    // Only allow adding contacts to draft campaigns
    if (campaign.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only add contacts to draft campaigns' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { contacts } = body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: 'Contacts array is required' },
        { status: 400 }
      );
    }

    // Get existing phone numbers to check for duplicates
    const existingContacts = await db
      .select({ phoneNumber: outboundContacts.phoneNumber })
      .from(outboundContacts)
      .where(eq(outboundContacts.campaignId, id));

    const existingPhones = new Set(existingContacts.map((c) => c.phoneNumber));

    // Prepare contacts for insertion
    const newContacts = [];
    const duplicates = [];

    for (const contact of contacts) {
      if (existingPhones.has(contact.phoneNumber)) {
        duplicates.push(contact);
        continue;
      }

      existingPhones.add(contact.phoneNumber);

      newContacts.push({
        campaignId: id,
        phoneNumber: contact.phoneNumber,
        firstName: contact.firstName,
        lastName: contact.lastName || null,
        email: contact.email || null,
        areaCode: contact.areaCode || null,
        timezone: contact.timezone || null,
        customFields: contact.customFields || null,
        status: 'pending' as const,
      });
    }

    // Insert contacts in batches
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < newContacts.length; i += batchSize) {
      const batch = newContacts.slice(i, i + batchSize);
      await db.insert(outboundContacts).values(batch);
      inserted += batch.length;
    }

    // Update campaign contact count
    const [{ count: totalContacts }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboundContacts)
      .where(eq(outboundContacts.campaignId, id));

    await db
      .update(outboundCampaigns)
      .set({
        totalContacts,
        updatedAt: new Date(),
      })
      .where(eq(outboundCampaigns.id, id));

    return NextResponse.json({
      inserted,
      duplicates: duplicates.length,
      total: totalContacts,
    });
  } catch (error) {
    console.error('Error adding contacts:', error);
    return NextResponse.json(
      { error: 'Failed to add contacts' },
      { status: 500 }
    );
  }
}

// DELETE - Remove all contacts from campaign
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
    const [campaign] = await db
      .select()
      .from(outboundCampaigns)
      .where(eq(outboundCampaigns.id, id))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Only allow clearing contacts from draft campaigns
    if (campaign.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only clear contacts from draft campaigns' },
        { status: 400 }
      );
    }

    await db
      .delete(outboundContacts)
      .where(eq(outboundContacts.campaignId, id));

    await db
      .update(outboundCampaigns)
      .set({
        totalContacts: 0,
        updatedAt: new Date(),
      })
      .where(eq(outboundCampaigns.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing contacts:', error);
    return NextResponse.json(
      { error: 'Failed to clear contacts' },
      { status: 500 }
    );
  }
}
