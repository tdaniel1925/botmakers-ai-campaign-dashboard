import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, organizations, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTemporaryPassword, sendCredentialsEmail } from '@/services/email-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/users/[id] - Get a single user
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const [user] = await db.query.users.findMany({
      where: eq(users.id, id),
      with: {
        organization: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error('[Users API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id] - Update a user
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { fullName, role, organizationId, hasSalesAccess, isActive, reportFrequency, reportScope, timezone } = body;

    // Validate organization if being changed to client_user
    if (role === 'client_user' && organizationId === undefined && !existingUser.organizationId) {
      return NextResponse.json(
        { error: 'Organization is required for client users' },
        { status: 400 }
      );
    }

    // Verify organization exists if provided
    if (organizationId) {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
      }
    }

    // Build update object
    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (fullName !== undefined) updateData.fullName = fullName;
    if (role !== undefined) updateData.role = role;
    if (organizationId !== undefined) updateData.organizationId = organizationId;
    if (hasSalesAccess !== undefined) updateData.hasSalesAccess = hasSalesAccess;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (reportFrequency !== undefined) updateData.reportFrequency = reportFrequency;
    if (reportScope !== undefined) updateData.reportScope = reportScope;
    if (timezone !== undefined) updateData.timezone = timezone;

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'update',
      entityType: 'user',
      entityId: id,
      details: {
        changes: body,
        previous: {
          fullName: existingUser.fullName,
          role: existingUser.role,
          organizationId: existingUser.organizationId,
          hasSalesAccess: existingUser.hasSalesAccess,
          isActive: existingUser.isActive,
        },
      },
    });

    // Fetch updated user with organization
    const [result] = await db.query.users.findMany({
      where: eq(users.id, id),
      with: {
        organization: true,
      },
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[Users API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Soft delete (deactivate) a user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Prevent self-deletion
    if (id === admin.id) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      );
    }

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete - set isActive to false
    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    // Log the action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'deactivate',
      entityType: 'user',
      entityId: id,
      details: { email: existingUser.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Users API] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deactivate user' },
      { status: 500 }
    );
  }
}

// POST /api/users/[id]/reset-password - Reset user password
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { sendEmail = true } = body;

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate new temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Update password in Supabase Auth
    const supabaseAdmin = createAdminClient();
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: temporaryPassword,
    });

    if (authError) {
      console.error('[Users API] Reset password auth error:', authError);
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    // Set must_change_password flag
    await db
      .update(users)
      .set({
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    // Log the action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'reset_password',
      entityType: 'user',
      entityId: id,
      details: { email: existingUser.email },
    });

    // Send credentials email if requested
    if (sendEmail) {
      const emailResult = await sendCredentialsEmail(
        existingUser.email,
        temporaryPassword,
        existingUser.fullName || undefined
      );
      if (!emailResult.success) {
        console.error('[Users API] Failed to send reset email:', emailResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      temporaryPassword: sendEmail ? undefined : temporaryPassword,
      message: sendEmail
        ? 'Password reset and new credentials sent via email'
        : 'Password reset successfully',
    });
  } catch (error) {
    console.error('[Users API] Reset password error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset password' },
      { status: 500 }
    );
  }
}
