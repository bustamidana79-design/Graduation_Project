export type Product = {
  id: string
  name: string
  description: string | null
  supplier_id: string
  wholesale_price: number
  min_order_quantity: number
  created_at: string
}
