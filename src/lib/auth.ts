import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, salesUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { User, SalesUser } from '@/db/schema';

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

// ============================================
// SALES USER AUTHENTICATION
// ============================================

export async function getSalesUser(): Promise<SalesUser | null> {
  const authUser = await getUser();
  if (!authUser) return null;

  const [salesUser] = await db
    .select()
    .from(salesUsers)
    .where(eq(salesUsers.id, authUser.id))
    .limit(1);

  return salesUser || null;
}

export async function requireSalesAuth(): Promise<SalesUser> {
  const authUser = await requireAuth();

  const [salesUser] = await db
    .select()
    .from(salesUsers)
    .where(eq(salesUsers.id, authUser.id))
    .limit(1);

  if (!salesUser) {
    // Not a sales user, redirect to appropriate login
    redirect('/sales/login?error=not_sales_user');
  }

  if (!salesUser.isActive) {
    redirect('/sales/login?error=account_disabled');
  }

  return salesUser;
}

export async function isSalesUser(): Promise<boolean> {
  const salesUser = await getSalesUser();
  return salesUser !== null && salesUser.isActive;
}

// Get user type - checks all user tables
export async function getUserType(): Promise<'admin' | 'client_user' | 'sales' | null> {
  const authUser = await getUser();
  if (!authUser) return null;

  // Check regular users table first
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (dbUser && dbUser.isActive) {
    return dbUser.role;
  }

  // Check sales users table
  const [salesUser] = await db
    .select()
    .from(salesUsers)
    .where(eq(salesUsers.id, authUser.id))
    .limit(1);

  if (salesUser && salesUser.isActive) {
    return 'sales';
  }

  return null;
}
