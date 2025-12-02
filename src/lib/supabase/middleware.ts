import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/accept-invite", "/api/webhooks", "/api/setup", "/api/admin/clients/accept-invite", "/api/admin/seed-demo"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If user is not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user is authenticated
  if (user) {
    // Check if admin user
    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .single();

    // Check if client user
    const { data: clientUser, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    const isAdmin = !!adminUser;
    const isClient = !!clientUser;

    // Log RLS errors for debugging (but don't block)
    if (adminError && adminError.code !== "PGRST116") {
      console.error("Admin check error:", adminError.message);
    }
    if (clientError && clientError.code !== "PGRST116") {
      console.error("Client check error:", clientError.message);
    }

    // Redirect authenticated users from login page
    if (pathname === "/login") {
      const url = request.nextUrl.clone();
      // If we can't determine user type, default to dashboard
      url.pathname = isAdmin ? "/admin" : "/dashboard";
      return NextResponse.redirect(url);
    }

    // Protect admin routes
    if (pathname.startsWith("/admin") && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = isClient ? "/dashboard" : "/login";
      return NextResponse.redirect(url);
    }

    // Protect preview-client routes (admin only)
    if (pathname.startsWith("/preview-client") && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = isClient ? "/dashboard" : "/login";
      return NextResponse.redirect(url);
    }

    // Protect client dashboard routes - but allow if we couldn't check due to RLS
    // PGRST116 = no rows found (expected), other errors might be RLS issues
    if (pathname.startsWith("/dashboard") && !isClient && !isAdmin) {
      // Only redirect to login if both checks definitively failed (no rows found)
      // If there was an RLS error, let the page handle it
      if (clientError?.code === "PGRST116" && adminError?.code === "PGRST116") {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
