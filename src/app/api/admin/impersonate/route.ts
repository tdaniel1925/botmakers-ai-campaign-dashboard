import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, organizations, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { cookies } from 'next/headers';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { impersonateSchema, validateRequest } from '@/lib/validations/admin';

// POST /api/admin/impersonate - Start impersonating a user or organization
export async function POST(request: NextRequest) {
  const log = createApiLogger('/api/admin/impersonate');
  try {
    const admin = await requireAdmin();
    log.info('Impersonation request', { adminId: admin.id });

    // Rate limiting - stricter for sensitive operations
    const rateLimit = withRateLimit(admin.id, 'admin-impersonate-post', RATE_LIMITS.auth);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded for impersonation', { adminId: admin.id });
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(impersonateSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { details: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { userId, organizationId } = validation.data;

    let targetUser = null;
    let targetOrg = null;

    if (userId) {
      // Find the user to impersonate
      const [user] = await db.query.users.findMany({
        where: and(
          eq(users.id, userId),
          eq(users.isActive, true)
        ),
        with: {
          organization: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Cannot impersonate another admin
      if (user.role === 'admin') {
        return NextResponse.json(
          { error: 'Cannot impersonate admin users' },
          { status: 400 }
        );
      }

      targetUser = user;
      targetOrg = user.organization;
    } else if (organizationId) {
      // Find the organization
      const [org] = await db
        .select()
        .from(organizations)
        .where(and(
          eq(organizations.id, organizationId),
          eq(organizations.isActive, true)
        ))
        .limit(1);

      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      // Find the first active user in this organization to impersonate
      const [orgUser] = await db.query.users.findMany({
        where: and(
          eq(users.organizationId, organizationId),
          eq(users.isActive, true),
          eq(users.role, 'client_user')
        ),
        with: {
          organization: true,
        },
        limit: 1,
      });

      if (!orgUser) {
        return NextResponse.json(
          { error: 'No active users found in this organization' },
          { status: 400 }
        );
      }

      targetUser = orgUser;
      targetOrg = org;
    }

    if (!targetUser || !targetOrg) {
      return NextResponse.json({ error: 'Could not find target user' }, { status: 400 });
    }

    // Store impersonation data in a cookie
    const impersonationData = {
      originalAdminId: admin.id,
      originalAdminEmail: admin.email,
      impersonatedUserId: targetUser.id,
      impersonatedUserEmail: targetUser.email,
      impersonatedOrgId: targetOrg.id,
      impersonatedOrgName: targetOrg.name,
      startedAt: new Date().toISOString(),
    };

    const cookieStore = await cookies();
    cookieStore.set('impersonation', JSON.stringify(impersonationData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hour
    });

    // Log the impersonation action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'impersonate_start',
      entityType: 'user',
      entityId: targetUser.id,
      details: {
        impersonatedEmail: targetUser.email,
        organizationId: targetOrg.id,
        organizationName: targetOrg.name,
      },
    });

    log.info('Impersonation started', {
      adminId: admin.id,
      targetUserId: targetUser.id,
      targetOrgId: targetOrg.id
    });
    return NextResponse.json({
      success: true,
      impersonating: {
        userId: targetUser.id,
        userEmail: targetUser.email,
        userName: targetUser.fullName,
        organizationId: targetOrg.id,
        organizationName: targetOrg.name,
      },
      redirectTo: '/dashboard',
    });
  } catch (error) {
    log.error('Failed to start impersonation', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start impersonation' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/impersonate - Stop impersonating
export async function DELETE(request: NextRequest) {
  const log = createApiLogger('/api/admin/impersonate');
  try {
    const cookieStore = await cookies();
    const impersonationCookie = cookieStore.get('impersonation');

    if (!impersonationCookie) {
      return NextResponse.json({ error: 'Not impersonating' }, { status: 400 });
    }

    const impersonationData = JSON.parse(impersonationCookie.value);

    // Log the end of impersonation
    await db.insert(auditLogs).values({
      userId: impersonationData.originalAdminId,
      action: 'impersonate_end',
      entityType: 'user',
      entityId: impersonationData.impersonatedUserId,
      details: {
        impersonatedEmail: impersonationData.impersonatedUserEmail,
        duration: Date.now() - new Date(impersonationData.startedAt).getTime(),
      },
    });

    // Clear the impersonation cookie
    cookieStore.delete('impersonation');

    log.info('Impersonation ended', { adminId: impersonationData.originalAdminId });
    return NextResponse.json({
      success: true,
      redirectTo: '/admin',
    });
  } catch (error) {
    log.error('Failed to stop impersonation', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop impersonation' },
      { status: 500 }
    );
  }
}

// GET /api/admin/impersonate - Check impersonation status
export async function GET(request: NextRequest) {
  const log = createApiLogger('/api/admin/impersonate');
  try {
    const cookieStore = await cookies();
    const impersonationCookie = cookieStore.get('impersonation');

    if (!impersonationCookie) {
      return NextResponse.json({ impersonating: false });
    }

    const impersonationData = JSON.parse(impersonationCookie.value);

    return NextResponse.json({
      impersonating: true,
      data: impersonationData,
    });
  } catch (error) {
    log.error('Failed to check impersonation status', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ impersonating: false });
  }
}
