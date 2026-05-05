import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuthProfile(request);
    const formData = await request.formData();
    const productId = String(formData.get("productId") || "");
    const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File);

    if (!productId || files.length === 0) {
      return NextResponse.json({ error: "يجب اختيار منتج وصورة واحدة على الأقل." }, { status: 400 });
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, supplier_id, stock_quantity")
      .eq("id", productId)
      .single();

    if (productError || !product || product.supplier_id !== user.id) {
      return NextResponse.json({ error: "لا يمكنك رفع صور لهذا المنتج." }, { status: 403 });
    }

    const { data: existingImages } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", productId);

    let hasPrimary = (existingImages?.length || 0) > 0;
    const uploaded: Record<string, unknown>[] = [];

    for (const file of files) {
      const path = `${user.id}/${productId}/${Date.now()}-${file.name}`;
      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(path, arrayBuffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        const message =
          uploadError.message.includes("Bucket not found")
            ? `لم يتم العثور على مساحة التخزين الخاصة بصور المنتجات. تأكد من إعداد NEXT_PUBLIC_PRODUCT_IMAGES_BUCKET أو استخدم bucket موجود مثل documents.`
            : uploadError.message;
        return NextResponse.json({ error: message }, { status: 500 });
      }

      const { data: imageRow, error: imageError } = await supabase
        .from("product_images")
        .insert({
          product_id: productId,
          image_url: path,
          is_primary: !hasPrimary,
        })
        .select("*")
        .single();

      if (imageError) {
        return NextResponse.json({ error: imageError.message }, { status: 500 });
      }

      hasPrimary = true;
      uploaded.push(imageRow);
    }

    await supabase
      .from("products")
      .update({ is_published: product.stock_quantity > 0 && hasPrimary })
      .eq("id", productId);

    return NextResponse.json({ images: uploaded }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل رفع الصور.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
