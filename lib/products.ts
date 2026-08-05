import { createClient } from "@/lib/supabase/server";

export async function getProducts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      sku,
      price,
      cost_price,
      stock_quantity,
      low_stock_threshold,
      is_active,
      category_id,
      categories ( name )
    `)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data;
}

export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  if (error) throw error;
  return data;
}

export async function getProductById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}