import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Public routes that don't require authentication (excluding root which is handled specially)
const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback', '/sales/login'];

// Webhook routes - no auth required (public endpoints)
const webhookRoutes = ['/api/webhook'];

// Sales routes (handled by sales auth)
const salesRoutes = ['/sales'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Refresh session - this keeps session alive and updates cookies
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Allow webhook routes without authentication
  if (webhookRoutes.some(route => path.startsWith(route))) {
    return response;
  }

  // Handle root path - redirect based on auth status (prevents redirect loop from page.tsx)
  if (path === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow public routes
  if (publicRoutes.some(route => path === route || path.startsWith(route + '/'))) {
    // Redirect logged-in users away from main auth pages to dashboard
    if (user && (path === '/login' || path === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // Sales routes (except /sales/login which is public)
  if (path.startsWith('/sales') && path !== '/sales/login') {
    if (!user) {
      return NextResponse.redirect(new URL('/sales/login', request.url));
    }
    // Let page components handle sales-specific auth
    return response;
  }

  // Require authentication for all other routes
  if (!user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(redirectUrl);
  }

  // For authenticated users, let the page handle role-based access
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (except webhooks which are handled above)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api/(?!webhook)).*)',
  ],
};
