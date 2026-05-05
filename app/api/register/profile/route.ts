import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const ACCOUNT_TYPES = new Set(["merchant", "small_business", "delivery", "supporter"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, fullName, email, phone, country, accountType } = body;

    if (!userId || !fullName || !email || !country || !accountType) {
      return NextResponse.json({ error: "Missing required profile fields." }, { status: 400 });
    }

    if (!ACCOUNT_TYPES.has(accountType)) {
      return NextResponse.json({ error: "Invalid account type." }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (authUserError || !authUserData.user) {
      return NextResponse.json({ error: "Auth user was not found." }, { status: 404 });
    }

    if (authUserData.user.email?.toLowerCase() !== String(email).trim().toLowerCase()) {
      return NextResponse.json({ error: "Profile email does not match auth user email." }, { status: 403 });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: String(fullName).trim(),
      email: String(email).trim(),
      phone: phone || null,
      country: String(country).trim(),
      account_type: accountType,
      status: "pending",
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected profile creation error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
