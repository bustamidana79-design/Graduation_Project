import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { normalizeCurrency } from "@/lib/currency";

const editableFields = ["full_name", "phone", "country", "city", "bio", "avatar_url", "preferred_currency"] as const;

function cleanText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuthProfile(request);
    const body = await request.json();

    const { data: existingProfile, error: existingError } = await supabase
      .from("profiles")
      .select("full_name, email, phone, country, city, bio, avatar_url, status, preferred_currency")
      .eq("id", user.id)
      .single();

    if (existingError || !existingProfile) {
      return NextResponse.json(
        { error: existingError?.message || "Profile not found." },
        { status: existingError ? 500 : 404 }
      );
    }

    const patch: Record<string, string> = {};
    for (const field of editableFields) {
      if (field in body) {
        const value = field === "preferred_currency" ? normalizeCurrency(body[field]) : cleanText(body[field]);
        if (value !== undefined) {
          patch[field] = value;
        }
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ profile: existingProfile });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("full_name, email, phone, country, city, bio, avatar_url, status, preferred_currency")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
