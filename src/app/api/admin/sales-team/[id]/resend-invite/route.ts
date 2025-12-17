import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { salesUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createAdminClient } from '@/lib/supabase/admin';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { uuidSchema } from '@/lib/validations/admin';
import { sendSalesWelcomeEmail, generateTemporaryPassword } from '@/services/email-service';

// POST /api/admin/sales-team/[id]/resend-invite - Resend invite email with new password
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/admin/sales-team/[id]/resend-invite');
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Validate UUID format
    if (!uuidSchema.safeParse(id).success) {
      log.warn('Invalid UUID format', { id });
      return NextResponse.json({ error: 'Invalid sales user ID format' }, { status: 400 });
    }

    log.info('Resending invite', { userId: admin.id, targetId: id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-resend-invite', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    // Get the sales user
    const [salesUser] = await db
      .select()
      .from(salesUsers)
      .where(eq(salesUsers.id, id))
      .limit(1);

    if (!salesUser) {
      return NextResponse.json({ error: 'Sales user not found' }, { status: 404 });
    }

    // Generate a new temporary password
    const newPassword = generateTemporaryPassword();

    // Update the user's password in Supabase
    const supabase = createAdminClient();
    const { error: updateError } = await supabase.auth.admin.updateUserById(id, {
      password: newPassword,
    });

    if (updateError) {
      log.error('Failed to update password in Supabase', { error: updateError.message });
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    // Update salesUsers table to require password change
    await db
      .update(salesUsers)
      .set({
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(salesUsers.id, id));

    // Send the welcome email with new credentials
    const emailResult = await sendSalesWelcomeEmail(
      salesUser.email,
      newPassword,
      salesUser.fullName
    );

    if (!emailResult.success) {
      log.error('Failed to send invite email', { email: salesUser.email, error: emailResult.error });
      return NextResponse.json(
        { error: 'Password reset but failed to send email. Please try again or share credentials manually.' },
        { status: 500 }
      );
    }

    log.info('Invite resent successfully', { targetId: id, email: salesUser.email });

    return NextResponse.json({
      success: true,
      message: 'Invite email sent successfully with new credentials',
    });
  } catch (error) {
    log.error('Failed to resend invite', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to resend invite' },
      { status: 500 }
    );
  }
}
