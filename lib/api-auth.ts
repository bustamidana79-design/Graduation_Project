import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createServerSupabase(token?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAuthProfile(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const authSupabase = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error("UNAUTHORIZED");
  }

  const supabase = createServerSupabase(token);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  return { supabase, user, profile, token };
}

export function isAdminProfile(profile: { account_type?: string | null }) {
  return profile.account_type === "admin";
}

/**
 * Check if user is admin from the profile account type.
 */
export async function checkIsAdmin(supabase: ReturnType<typeof createServerSupabase>, userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", userId)
      .single();

    return isAdminProfile(profile || {});
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Require admin role - throws error if not admin
 */
export async function requireAdmin(request: NextRequest) {
  const { supabase, user, profile } = await requireAuthProfile(request);
  
  const isAdmin = await checkIsAdmin(supabase, user.id);
  
  if (!isAdmin) {
    throw new Error("FORBIDDEN");
  }
  
  return { supabase, user, profile };
}

/**
 * Require admin role for API routes - returns response if not authorized
 */
export async function requireAdminApi(request: NextRequest) {
  try {
    return await requireAdmin(request);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (error.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
