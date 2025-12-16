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

// Type for users who can access the sales portal
export interface SalesAuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  commissionRate: number;
  isActive: boolean;
  mustChangePassword: boolean;
  hasSeenWelcome: boolean;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Additional fields for access type
  accessType: 'sales_user' | 'admin' | 'user_with_access';
}

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

export async function requireSalesAuth(): Promise<SalesAuthUser> {
  const authUser = await requireAuth();

  // First check if user is a dedicated sales user
  const [salesUser] = await db
    .select()
    .from(salesUsers)
    .where(eq(salesUsers.id, authUser.id))
    .limit(1);

  if (salesUser) {
    if (!salesUser.isActive) {
      redirect('/sales/login?error=account_disabled');
    }
    return {
      ...salesUser,
      accessType: 'sales_user',
    };
  }

  // Check if user is an admin or has sales access
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (dbUser) {
    // Admins can always view the sales portal
    if (dbUser.role === 'admin') {
      return {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.fullName || 'Admin',
        phone: null,
        commissionRate: 0,
        isActive: true,
        mustChangePassword: false,
        hasSeenWelcome: true, // Admins don't need welcome
        bio: null,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
        accessType: 'admin',
      };
    }

    // Users with hasSalesAccess can access the portal
    if (dbUser.hasSalesAccess && dbUser.isActive) {
      return {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.fullName || dbUser.email.split('@')[0],
        phone: null,
        commissionRate: 18, // Default commission rate
        isActive: true,
        mustChangePassword: dbUser.mustChangePassword,
        hasSeenWelcome: true, // Users with access are considered onboarded
        bio: null,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
        accessType: 'user_with_access',
      };
    }
  }

  // Not authorized for sales portal
  redirect('/sales/login?error=not_sales_user');
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
