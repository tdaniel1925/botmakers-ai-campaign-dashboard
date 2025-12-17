import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { outboundCampaigns, users, organizations } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// GET - List outbound campaigns
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status');

    let query = db
      .select({
        id: outboundCampaigns.id,
        name: outboundCampaigns.name,
        description: outboundCampaigns.description,
        status: outboundCampaigns.status,
        organizationId: outboundCampaigns.organizationId,
        organizationName: organizations.name,
        totalContacts: outboundCampaigns.totalContacts,
        contactsCalled: outboundCampaigns.contactsCalled,
        contactsAnswered: outboundCampaigns.contactsAnswered,
        currentStep: outboundCampaigns.currentStep,
        isWizardComplete: outboundCampaigns.isWizardComplete,
        createdAt: outboundCampaigns.createdAt,
        updatedAt: outboundCampaigns.updatedAt,
      })
      .from(outboundCampaigns)
      .leftJoin(organizations, eq(outboundCampaigns.organizationId, organizations.id))
      .orderBy(desc(outboundCampaigns.createdAt));

    // Filter by organization if specified (for client users)
    if (organizationId) {
      query = query.where(eq(outboundCampaigns.organizationId, organizationId)) as typeof query;
    }

    // For client_user role, only show their organization's campaigns
    if (dbUser.role === 'client_user' && dbUser.organizationId) {
      query = query.where(eq(outboundCampaigns.organizationId, dbUser.organizationId)) as typeof query;
    }

    const campaigns = await query;

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Error fetching outbound campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

// POST - Create new outbound campaign (draft)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and verify admin role
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!dbUser || dbUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, organizationId } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Campaign name is required' },
        { status: 400 }
      );
    }

    if (!organizationId || typeof organizationId !== 'string') {
      return NextResponse.json(
        { error: 'Organization is required' },
        { status: 400 }
      );
    }

    // Verify organization exists
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Create campaign in draft status
    const [campaign] = await db
      .insert(outboundCampaigns)
      .values({
        organizationId,
        name: name.trim(),
        description: description?.trim() || null,
        webhookUuid: uuidv4(),
        status: 'draft',
        currentStep: 1,
        isWizardComplete: false,
      })
      .returning();

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error('Error creating outbound campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}
