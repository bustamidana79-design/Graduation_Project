import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    await requireAuthProfile(request);
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("shipping_company_profiles")
      .select("user_id, company_name")
      .order("company_name", { ascending: true });

    console.log("shipping companies:", data);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const companies = (data || []).map((company) => ({
      id: company.user_id,
      user_id: company.user_id,
      company_name: company.company_name,
    }));

    return NextResponse.json(companies);
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل شركات الشحن.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
