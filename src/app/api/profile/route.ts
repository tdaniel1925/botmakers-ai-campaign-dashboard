import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireFullAuth } from '@/lib/auth';

const updateProfileSchema = z.object({
  fullName: z.string().optional(),
  timezone: z.string().optional(),
  reportFrequency: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
  reportScope: z.enum(['all_campaigns', 'per_campaign']).nullable().optional(),
});

// GET /api/profile - Get current user profile
export async function GET() {
  try {
    const user = await requireFullAuth();

    const [profile] = await db.query.users.findMany({
      where: eq(users.id, user.id),
      with: {
        organization: true,
      },
      limit: 1,
    });

    return NextResponse.json({ data: profile });
  } catch (error) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/profile - Update current user profile
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireFullAuth();

    const body = await req.json();
    const result = updateProfileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (result.data.fullName !== undefined) updateData.fullName = result.data.fullName;
    if (result.data.timezone !== undefined) updateData.timezone = result.data.timezone;
    if (result.data.reportFrequency !== undefined) updateData.reportFrequency = result.data.reportFrequency;
    if (result.data.reportScope !== undefined) updateData.reportScope = result.data.reportScope;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, user.id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('PATCH /api/profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
