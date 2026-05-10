import { NextRequest, NextResponse } from "next/server";
import { isAdminProfile, requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuthProfile(request);
    if (!isAdminProfile(profile)) {
      return NextResponse.json({ error: "غير مصرح لك بعرض هذه البيانات." }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!products || products.length === 0) {
      return NextResponse.json({ products: [] });
    }

    const supplierIds = Array.from(new Set((products || []).map((product) => product.supplier_id)));
    const [{ data: images }, { data: suppliers }] = await Promise.all([
      supabase.from("product_images").select("product_id, image_url, is_primary").in("product_id", (products || []).map((p) => p.id)),
      supabase.from("supplier_profiles").select("user_id, store_name").in("user_id", supplierIds),
    ]);

    const imageMap = new Map<string, { image_url: string; is_primary: boolean }[]>();
    for (const image of images || []) {
      const list = imageMap.get(image.product_id) || [];
      list.push(image);
      imageMap.set(image.product_id, list);
    }

    const supplierMap = new Map<string, string>();
    for (const supplier of suppliers || []) {
      supplierMap.set(supplier.user_id, supplier.store_name || "متجر المورد");
    }

    const result = (products || []).map((product) => ({
      ...product,
      supplier_store_name: supplierMap.get(product.supplier_id) || "متجر المورد",
      primary_image:
        (imageMap.get(product.id) || []).find((image) => image.is_primary) ||
        (imageMap.get(product.id) || [])[0] ||
        null,
    }));

    return NextResponse.json({ products: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل منتجات الأدمن.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
