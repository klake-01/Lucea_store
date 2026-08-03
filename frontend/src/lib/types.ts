// TypeScript interfaces for LUCÉA API

export interface User {
  id: string;
  username: string;
  email: string;
  role_name: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  brand: string;
  status: 'draft' | 'published' | 'archived';
  variants: Variant[];
  images: ProductImage[];
  categories: Category[];
  created_at: string;
  updated_at: string;
}

export interface Variant {
  id: string;
  sku: string;
  product_id: string;
  price_cents: number;
  stock: number;
  size_attribute?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt: string;
  position: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  parent_id?: string;
}

export interface CartItem {
  id: string;
  variant_id: string;
  quantity: number;
  config_text?: string;
  variant?: Variant;
}

export interface Cart {
  id: string;
  customer_id?: string;
  session_id?: string;
  items: CartItem[];
  subtotal_cents: number;
  delivery_cents: number;
  discount_cents: number;
  total_cents: number;
}

export interface Order {
  id: string;
  order_number: string;
  phone: string;
  name: string;
  city: string;
  address_line: string;
  subtotal_cents: number;
  delivery_charge_cents: number;
  discount_cents: number;
  total_cents: number;
  status: string;
  payment_method: string;
  created_at: string;
}
