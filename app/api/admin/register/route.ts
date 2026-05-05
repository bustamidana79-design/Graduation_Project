import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isAdminProfile } from "@/lib/api-auth";

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || "COREX_ADMIN_SECRET";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, password, secretKey } = body;

    // Validate secret key
    if (secretKey !== ADMIN_SECRET_KEY) {
      return NextResponse.json(
        { error: "Invalid secret key" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // Step 1: Create auth user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback`,
      },
    });

    if (signUpError) {
      return NextResponse.json(
        { error: signUpError.message },
        { status: 400 }
      );
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    // Step 2: Create profile with admin account_type
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName,
      email,
      phone: null,
      country: "System",
      account_type: "admin",
      status: "approved",
    });

    if (profileError) {
      // Try to cleanup auth user if profile creation fails
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: `Failed to save profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    // Step 3: Get admin role and assign to user
    try {
      const { data: roleData } = await supabase
        .from("roles")
        .select("id")
        .eq("name", "admin")
        .single();

      if (roleData) {
        await supabase.from("profile_roles").insert({
          user_id: userId,
          role_id: roleData.id,
        });
      }
    } catch (roleError) {
      console.error("Error assigning admin role:", roleError);
      // Continue anyway - profile is created
    }

    return NextResponse.json({
      success: true,
      message: "Admin account created successfully",
      userId,
    });
  } catch (error: any) {
    console.error("Admin registration error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// GET method to check if admin registration is available
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (key === ADMIN_SECRET_KEY) {
    return NextResponse.json({
      valid: true,
      message: "Admin registration key is valid",
    });
  }

  return NextResponse.json(
    { valid: false, error: "Invalid key" },
    { status: 401 }
  );
}