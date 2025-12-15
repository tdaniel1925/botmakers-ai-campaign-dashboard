import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { organizations, auditLogs } from '@/db/schema';
import { eq, desc, ilike, or, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  contactEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// GET - List all organizations
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    let whereClause = includeArchived ? undefined : eq(organizations.isActive, true);

    if (search) {
      const searchCondition = or(
        ilike(organizations.name, `%${search}%`),
        ilike(organizations.contactEmail, `%${search}%`)
      );
      whereClause = whereClause
        ? and(whereClause, searchCondition)
        : searchCondition;
    }

    const [orgs, totalResult] = await Promise.all([
      db
        .select()
        .from(organizations)
        .where(whereClause)
        .orderBy(desc(organizations.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: organizations.id })
        .from(organizations)
        .where(whereClause),
    ]);

    const total = totalResult.length;

    return NextResponse.json({
      data: orgs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/organizations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new organization
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();

    const body = await req.json();
    const result = createOrganizationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const [organization] = await db
      .insert(organizations)
      .values({
        name: result.data.name,
        contactEmail: result.data.contactEmail || null,
        phone: result.data.phone || null,
        address: result.data.address || null,
      })
      .returning();

    // Create audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'create',
      entityType: 'organization',
      entityId: organization.id,
      details: { name: organization.name },
    });

    return NextResponse.json({ data: organization }, { status: 201 });
  } catch (error) {
    console.error('POST /api/organizations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
