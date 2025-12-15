import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { organizations, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET - Get single organization
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: organization });
  } catch (error) {
    console.error('GET /api/organizations/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update organization
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAdmin();
    const { id } = await params;

    const body = await req.json();
    const result = updateOrganizationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Check if organization exists
    const [existing] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Update organization
    const [updated] = await db
      .update(organizations)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning();

    // Create audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'update',
      entityType: 'organization',
      entityId: id,
      details: result.data,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('PATCH /api/organizations/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete (archive) organization
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAdmin();
    const { id } = await params;

    // Check if organization exists
    const [existing] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Soft delete
    await db
      .update(organizations)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id));

    // Create audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'delete',
      entityType: 'organization',
      entityId: id,
      details: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/organizations/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
