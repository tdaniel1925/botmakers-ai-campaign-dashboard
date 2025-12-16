import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { users, salesUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/auth/change-password - Works for all user types (admin, client, sales)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current authenticated user from Supabase
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = changePasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Update password via Supabase Auth
    const { error } = await supabase.auth.updateUser({
      password: result.data.newPassword,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Try to update regular user's must_change_password flag
    const [regularUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (regularUser) {
      await db
        .update(users)
        .set({
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, authUser.id));
    }

    // Try to update sales user's must_change_password flag
    const [salesUser] = await db
      .select({ id: salesUsers.id })
      .from(salesUsers)
      .where(eq(salesUsers.id, authUser.id))
      .limit(1);

    if (salesUser) {
      await db
        .update(salesUsers)
        .set({
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(salesUsers.id, authUser.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/auth/change-password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
