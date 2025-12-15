import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { campaigns, organizations, auditLogs } from '@/db/schema';
import { eq, desc, and, ilike, or } from 'drizzle-orm';
import { requireAdmin, requireFullAuth } from '@/lib/auth';

const createCampaignSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  twilioPhoneNumber: z.string().optional(),
  twilioOverride: z.boolean().default(false),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  aiExtractionHints: z.record(z.string(), z.string()).optional(),
});

// GET - List campaigns
export async function GET(req: NextRequest) {
  try {
    const user = await requireFullAuth();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const organizationId = searchParams.get('organizationId');
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const conditions = [];

    // For client users, only show their organization's campaigns
    if (user.role === 'client_user') {
      if (!user.organizationId) {
        return NextResponse.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 } });
      }
      conditions.push(eq(campaigns.organizationId, user.organizationId));
    } else if (organizationId) {
      // Admin filtering by organization
      conditions.push(eq(campaigns.organizationId, organizationId));
    }

    if (!includeArchived) {
      conditions.push(eq(campaigns.isActive, true));
    }

    if (search) {
      conditions.push(
        or(
          ilike(campaigns.name, `%${search}%`),
          ilike(campaigns.description, `%${search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [campaignsList, totalResult] = await Promise.all([
      db.query.campaigns.findMany({
        where: whereClause,
        orderBy: [desc(campaigns.createdAt)],
        limit,
        offset,
        with: {
          organization: true,
        },
      }),
      db
        .select({ count: campaigns.id })
        .from(campaigns)
        .where(whereClause),
    ]);

    const total = totalResult.length;

    // Generate webhook URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const campaignsWithUrls = campaignsList.map((campaign) => ({
      ...campaign,
      webhookUrl: `${baseUrl}/api/webhook/${campaign.webhookUuid}`,
      // Don't expose Twilio auth token
      twilioAuthToken: campaign.twilioAuthToken ? '••••••••' : null,
    }));

    return NextResponse.json({
      data: campaignsWithUrls,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/campaigns error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new campaign
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();

    const body = await req.json();
    const result = createCampaignSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Verify organization exists
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, result.data.organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Create campaign
    const [campaign] = await db
      .insert(campaigns)
      .values({
        organizationId: result.data.organizationId,
        name: result.data.name,
        description: result.data.description || null,
        twilioPhoneNumber: result.data.twilioPhoneNumber || null,
        twilioOverride: result.data.twilioOverride,
        twilioAccountSid: result.data.twilioAccountSid || null,
        twilioAuthToken: result.data.twilioAuthToken || null,
        aiExtractionHints: (result.data.aiExtractionHints || {}) as Record<string, string>,
      })
      .returning();

    // Create audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'create',
      entityType: 'campaign',
      entityId: campaign.id,
      details: { name: campaign.name, organizationId: campaign.organizationId },
    });

    // Generate webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const campaignWithUrl = {
      ...campaign,
      webhookUrl: `${baseUrl}/api/webhook/${campaign.webhookUuid}`,
      twilioAuthToken: campaign.twilioAuthToken ? '••••••••' : null,
    };

    return NextResponse.json({ data: campaignWithUrl }, { status: 201 });
  } catch (error) {
    console.error('POST /api/campaigns error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
