type SupabaseClient = {
  from: (table: string) => any;
};

export async function listFavorites(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("favorites")
    .select("*, products(*, product_images(id, image_url, is_primary))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function toggleFavorite(supabase: SupabaseClient, userId: string, productId: string) {
  if (!productId) throw new Error("PRODUCT_REQUIRED");

  const existing = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing.error && existing.error.code !== "PGRST116") throw new Error(existing.error.message);

  if (existing.data) {
    const { error } = await supabase.from("favorites").delete().eq("id", existing.data.id);
    if (error) throw new Error(error.message);
    return { favorited: false };
  }

  const { error } = await supabase.from("favorites").insert({ user_id: userId, product_id: productId });
  if (error) throw new Error(error.message);
  return { favorited: true };
}
