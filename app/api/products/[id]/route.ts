import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, requireAuthProfile } from "@/lib/api-auth";
import { normalizeCurrency } from "@/lib/currency";

async function buildProductDetails(productId: string) {
  const supabase = createServerSupabase();
  const { data: product, error } = await supabase.from("products").select("*").eq("id", productId).single();

  if (error || !product) {
    return { error: "المنتج غير موجود." };
  }

  const [{ data: images }, { data: supplier }, { data: profile }] = await Promise.all([
    supabase
      .from("product_images")
      .select("id, image_url, is_primary")
      .eq("product_id", productId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("supplier_profiles")
      .select("user_id, store_name")
      .eq("user_id", product.supplier_id)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name, account_type")
      .eq("id", product.supplier_id)
      .maybeSingle(),
  ]);
  const supplierName = supplier?.store_name || profile?.full_name || "متجر المورد";

  return {
    product: {
      ...product,
      price: Number(product.wholesale_price || 0),
      currency: product.currency || "ILS",
      supplier_name: supplierName,
      supplier_type: profile?.account_type || "merchant",
      images: images || [],
      supplier: supplier ? { ...supplier, account_type: profile?.account_type || "merchant" } : null,
    },
  };
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await buildProductDetails(id);

  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }

  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuthProfile(request);
    const { id } = await context.params;
    const body = await request.json();

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, supplier_id")
      .eq("id", id)
      .single();

    if (productError || !product || product.supplier_id !== user.id) {
      return NextResponse.json({ error: "لا يمكنك تعديل هذا المنتج." }, { status: 403 });
    }

    const patch = {
      name: String(body.name || "").trim(),
      description: String(body.description || "").trim(),
      wholesale_price: Number(body.wholesale_price || 0),
      currency: normalizeCurrency(body.currency),
      min_order_quantity: Math.max(1, Number(body.min_order_quantity || 1)),
      stock_quantity: Math.max(0, Number(body.stock_quantity || 0)),
      category_id: body.category_id || null,
    };

    const { error } = await supabase
      .from("products")
      .update(patch)
      .eq("id", id)
      .eq("supplier_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: imageRows } = await supabase.from("product_images").select("id").eq("product_id", id);
    await supabase
      .from("products")
      .update({ is_published: patch.stock_quantity > 0 && (imageRows?.length || 0) > 0 })
      .eq("id", id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تعديل المنتج.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuthProfile(request);
    const { id } = await context.params;

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, supplier_id")
      .eq("id", id)
      .single();

    if (productError || !product || product.supplier_id !== user.id) {
      return NextResponse.json({ error: "لا يمكنك حذف هذا المنتج." }, { status: 403 });
    }

    await supabase.from("product_images").delete().eq("product_id", id);
    const { error } = await supabase.from("products").delete().eq("id", id).eq("supplier_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل حذف المنتج.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
