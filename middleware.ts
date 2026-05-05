import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
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
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError);
  }

  // Protected admin routes
  const protectedAdminPaths = [
    "/dashboard/admin",
    "/admin/products",
    "/admin/users",
    "/admin/settings",
  ];

  const isProtectedAdminPath = protectedAdminPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedAdminPath) {
    // No session - redirect to login
    if (!session) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Check if user is admin
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", session.user.id)
        .single();

      // Check account_type or profile_roles
      let isAdmin = profile?.account_type === "admin";

      if (!isAdmin) {
        // Check profile_roles table
        const { data: roleData } = await supabase
          .from("profile_roles")
          .select(`
            roles (
              name
            )
          `)
          .eq("user_id", session.user.id);

        isAdmin =
          roleData?.some((r: any) =>
            Array.isArray(r.roles)
              ? r.roles.some((role: { name?: string }) => role.name === "admin")
              : r.roles?.name === "admin"
          ) || false;
      }

      if (!isAdmin) {
        // Not admin - redirect to home with error
        return NextResponse.redirect(new URL("/?error=admin_required", request.url));
      }
    } catch (error) {
      console.error("Admin check error:", error);
      return NextResponse.redirect(new URL("/?error=admin_required", request.url));
    }
  }

  // Auth routes - redirect to dashboard if already logged in
  const authPaths = ["/login", "/register", "/forgot-password"];
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isAuthPath && session) {
    // Check account type and redirect accordingly
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type, status")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        if (profile.status === "pending") {
          return NextResponse.redirect(new URL("/pending", request.url));
        }

        const accountTypeRedirects: Record<string, string> = {
          admin: "/dashboard/admin",
          merchant: "/dashboard/supplier",
          small_business: "/dashboard/small-business",
          delivery: "/dashboard/shipping-company",
          supporter: "/dashboard/supporter",
        };

        const redirectPath = accountTypeRedirects[profile.account_type];
        if (redirectPath) {
          return NextResponse.redirect(new URL(redirectPath, request.url));
        }
      }
    } catch (error) {
      console.error("Auth redirect error:", error);
    }
  }

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
     * - api routes (except admin API)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
