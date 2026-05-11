export type ProductImage = {
  id?: string;
  image_url: string;
  is_primary: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  supplier_id: string;
  price?: number;
  wholesale_price: number;
  currency?: string;
  converted_wholesale_price?: number;
  original_wholesale_price?: number;
  original_currency?: string;
  min_order_quantity: number;
  stock_quantity: number;
  category_id?: string | null;
  is_published?: boolean;
  created_at: string;
  supplier_name?: string;
  supplier_type?: string;
  supplier_store_name?: string;
  primary_image?: ProductImage | null;
  images?: ProductImage[];
  supplier?: {
    user_id: string;
    store_name: string;
    account_type?: string | null;
  } | null;
};
