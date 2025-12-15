import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { User } from '@/db/schema';

export async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getFullUser(): Promise<User | null> {
  const authUser = await getUser();
  if (!authUser) return null;

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  return dbUser || null;
}

export async function requireAuth() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return user;
}

export async function requireFullAuth(): Promise<User> {
  const authUser = await requireAuth();

  let [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  // Auto-create user record if it doesn't exist (first admin setup)
  if (!dbUser) {
    // Check if this is the first user (should be admin)
    const [existingUser] = await db.select().from(users).limit(1);
    const isFirstUser = !existingUser;

    [dbUser] = await db
      .insert(users)
      .values({
        id: authUser.id,
        email: authUser.email!,
        fullName: authUser.user_metadata?.full_name || null,
        role: isFirstUser ? 'admin' : 'client_user',
        isActive: true,
      })
      .returning();
  }

  if (!dbUser.isActive) {
    redirect('/login?error=account_disabled');
  }

  return dbUser;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireFullAuth();

  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  return user;
}

export async function requireClientUser(): Promise<User> {
  const user = await requireFullAuth();

  if (user.role !== 'client_user') {
    redirect('/admin');
  }

  if (!user.organizationId) {
    redirect('/login?error=no_organization');
  }

  return user;
}

export async function checkMustChangePassword(): Promise<boolean> {
  const user = await getFullUser();
  return user?.mustChangePassword ?? false;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getFullUser();
  return user?.role === 'admin';
}

export async function isClientUser(): Promise<boolean> {
  const user = await getFullUser();
  return user?.role === 'client_user';
}
