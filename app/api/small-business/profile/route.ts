import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    if (profile.account_type !== "small_business") {
      return NextResponse.json({ error: "هذه العملية متاحة للمشاريع الصغيرة فقط." }, { status: 403 });
    }

    const body = await request.json();
    const needs = Array.isArray(body.needs)
      ? body.needs.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];
    const socialLink = String(body.social_link || body.socialLink || "").trim();
    const patch = {
      needs,
      ...(socialLink ? { social_link: socialLink } : {}),
    };

    const { error: updateError } = await supabase
      .from("small_business_profiles")
      .update(patch)
      .eq("user_id", user.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    let { data, error } = await supabase
      .from("small_business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!error && !data) {
      const created = await supabase
        .from("small_business_profiles")
        .insert({
          user_id: user.id,
          project_name: profile.full_name || "مشروع",
          project_field: "غير محدد",
          project_stage: "running",
          social_link: socialLink || null,
          needs,
        })
        .select("*")
        .single();

      data = created.data;
      error = created.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile: { ...(data || {}), needs } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث بيانات المشروع.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
