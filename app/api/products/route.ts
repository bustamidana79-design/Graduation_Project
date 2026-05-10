import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, requireAuthProfile } from "@/lib/api-auth";

async function enrichProducts(products: Record<string, unknown>[]) {
  if (products.length === 0) return [];

  const supabase = createServerSupabase();
  const supplierIds = Array.from(
    new Set(products.map((product) => String(product.supplier_id || "")).filter(Boolean))
  );

  const [{ data: images }, { data: suppliers }, { data: profiles }] = await Promise.all([
    supabase
      .from("product_images")
      .select("id, product_id, image_url, is_primary")
      .in("product_id", products.map((product) => String(product.id))),
    supabase
      .from("supplier_profiles")
      .select("user_id, store_name")
      .in("user_id", supplierIds),
    supabase
      .from("profiles")
      .select("id, full_name, account_type")
      .in("id", supplierIds),
  ]);

  const imageMap = new Map<string, Record<string, unknown>[]>();
  for (const image of images || []) {
    const list = imageMap.get(String(image.product_id)) || [];
    list.push(image);
    imageMap.set(String(image.product_id), list);
  }

  const supplierMap = new Map<string, string>();
  for (const supplier of suppliers || []) {
    supplierMap.set(String(supplier.user_id), String(supplier.store_name || ""));
  }

  const profileMap = new Map<string, { full_name: string; account_type: string }>();
  for (const profile of profiles || []) {
    profileMap.set(String(profile.id), {
      full_name: String(profile.full_name || ""),
      account_type: String(profile.account_type || ""),
    });
  }

  return products
    .map((product) => {
      const productImages = imageMap.get(String(product.id)) || [];
      const primaryImage =
        productImages.find((image) => Boolean(image.is_primary)) || productImages[0] || null;
      const supplierId = String(product.supplier_id);
      const supplierName = supplierMap.get(supplierId) || profileMap.get(supplierId)?.full_name || "متجر المورد";

      return {
        ...product,
        supplier_id: supplierId,
        supplier_name: supplierName,
        supplier_type: profileMap.get(supplierId)?.account_type || "merchant",
        supplier_store_name: supplierName,
        primary_image: primaryImage,
      };
    })
    .filter((product) => Boolean(product.primary_image));
}

export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .gt("stock_quantity", 0)
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const products = await enrichProducts((data || []) as Record<string, unknown>[]);
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "فشل تحميل المنتجات." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json();

    let { data: supplierProfile, error: supplierError } = await supabase
      .from("supplier_profiles")
      .select("user_id, store_name")
      .eq("user_id", user.id)
      .single();

    if ((supplierError || !supplierProfile) && profile.account_type === "merchant") {
      const fallbackStoreName =
        String(body.store_name || "").trim() ||
        String(profile.full_name || "").trim() ||
        "متجر المورد";

      const { data: createdSupplierProfile, error: createSupplierError } = await supabase
        .from("supplier_profiles")
        .upsert(
          {
            user_id: user.id,
            store_name: fallbackStoreName,
          },
          { onConflict: "user_id" }
        )
        .select("user_id, store_name")
        .single();

      supplierProfile = createdSupplierProfile;
      supplierError = createSupplierError;
    }

    if (supplierError || !supplierProfile || profile.account_type !== "merchant") {
      return NextResponse.json(
        { error: "الحساب الحالي ليس موردا جاهزا لإضافة منتجات. تأكد أن نوع الحساب تاجر (جملة)." },
        { status: 403 }
      );
    }

    const payload = {
      supplier_id: user.id,
      name: String(body.name || "").trim(),
      description: String(body.description || "").trim(),
      wholesale_price: Number(body.wholesale_price || 0),
      min_order_quantity: Math.max(1, Number(body.min_order_quantity || 1)),
      stock_quantity: Math.max(0, Number(body.stock_quantity || 0)),
      category_id: body.category_id || null,
      is_published: false,
    };

    if (!payload.name || payload.wholesale_price <= 0 || payload.stock_quantity <= 0) {
      return NextResponse.json(
        { error: "بيانات المنتج غير مكتملة. تأكد من الاسم والسعر والمخزون." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.from("products").insert(payload).select("*").single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل إنشاء المنتج.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
