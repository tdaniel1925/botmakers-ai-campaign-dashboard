import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { AdminRole } from "@/types";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  is_active?: boolean;
}

export interface AuthResult {
  authenticated: boolean;
  admin: AdminUser | null;
  error?: string;
}

/**
 * Verify that the current request is from an authenticated admin user
 * Use this in API routes that require admin access
 */
export async function verifyAdmin(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore errors in server components
            }
          },
        },
      }
    );

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        authenticated: false,
        admin: null,
        error: "Not authenticated",
      };
    }

    // Check if user is an admin
    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("id, email, name, role")
      .eq("id", user.id)
      .single();

    if (adminError || !adminUser) {
      return {
        authenticated: false,
        admin: null,
        error: "Not authorized - admin access required",
      };
    }

    return {
      authenticated: true,
      admin: adminUser as AdminUser,
    };
  } catch (error) {
    console.error("Admin auth verification error:", error);
    return {
      authenticated: false,
      admin: null,
      error: "Authentication error",
    };
  }
}

/**
 * Helper to return an unauthorized response
 */
export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Helper to return a forbidden response
 */
export function forbiddenResponse(message = "Forbidden - Admin access required") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Wrapper for admin-only API route handlers
 * Automatically verifies admin auth before executing the handler
 */
export function withAdminAuth<T>(
  handler: (admin: AdminUser, request: Request) => Promise<NextResponse<T>>
) {
  return async (request: Request): Promise<NextResponse> => {
    const authResult = await verifyAdmin();

    if (!authResult.authenticated || !authResult.admin) {
      return authResult.error === "Not authenticated"
        ? unauthorizedResponse(authResult.error)
        : forbiddenResponse(authResult.error);
    }

    return handler(authResult.admin, request);
  };
}
