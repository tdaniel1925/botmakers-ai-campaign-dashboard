import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, organizations, auditLogs } from '@/db/schema';
import { eq, and, ilike, or, desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTemporaryPassword, sendCredentialsEmail } from '@/services/email-service';

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const organizationId = searchParams.get('organizationId');
    const role = searchParams.get('role');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    let query = db.query.users.findMany({
      where: and(
        // Filter by active status
        includeArchived ? undefined : eq(users.isActive, true),
        // Filter by organization if provided
        organizationId ? eq(users.organizationId, organizationId) : undefined,
        // Filter by role if provided
        role ? eq(users.role, role as 'admin' | 'client_user') : undefined,
        // Search by email or name
        search
          ? or(
              ilike(users.email, `%${search}%`),
              ilike(users.fullName, `%${search}%`)
            )
          : undefined
      ),
      with: {
        organization: true,
      },
      orderBy: [desc(users.createdAt)],
    });

    const result = await query;

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[Users API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();

    const { email, fullName, role, organizationId, sendCredentials = true, password } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check if client_user has an organization
    if (role === 'client_user' && !organizationId) {
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

    // Use provided password or generate a new one
    const temporaryPassword = password || generateTemporaryPassword();

    // Create user in Supabase Auth
    const supabaseAdmin = createAdminClient();
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error('[Users API] Auth error:', authError);
      if (authError.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: authError.message || 'Failed to create auth user' },
        { status: 500 }
      );
    }

    // Create user in database
    const [newUser] = await db
      .insert(users)
      .values({
        id: authUser.user.id,
        email,
        fullName: fullName || null,
        role: role || 'client_user',
        organizationId: organizationId || null,
        mustChangePassword: true,
        isActive: true,
      })
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'create',
      entityType: 'user',
      entityId: newUser.id,
      details: {
        email,
        role: role || 'client_user',
        organizationId,
      },
    });

    // Send credentials email if requested
    if (sendCredentials) {
      const emailResult = await sendCredentialsEmail(email, temporaryPassword, fullName);
      if (!emailResult.success) {
        console.error('[Users API] Failed to send credentials email:', emailResult.error);
        // Don't fail the request, just log the error
      }
    }

    // Fetch the user with organization data
    const [createdUser] = await db.query.users.findMany({
      where: eq(users.id, newUser.id),
      with: {
        organization: true,
      },
    });

    return NextResponse.json({
      data: createdUser,
      temporaryPassword: sendCredentials ? undefined : temporaryPassword,
      message: sendCredentials
        ? 'User created and credentials sent via email'
        : 'User created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[Users API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create user' },
      { status: 500 }
    );
  }
}
