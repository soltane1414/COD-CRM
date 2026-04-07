// ============================================================
// COD CRM — Storefront Public API (No auth required)
// ============================================================

import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const storefrontApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ── Types ─────────────────────────────────────────────────

export interface StoreInfo {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
}

export interface StorefrontProduct {
  id: number;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  sku: string | null;
  image_url: string | null;
  stock_quantity: number;
}

export interface PlaceOrderPayload {
  customer_name: string;
  customer_phone: string;
  customer_phone_2?: string;
  wilaya_id: number;
  commune: string;
  address: string;
  notes?: string;
  items: Array<{
    product_id: number;
    quantity: number;
  }>;
}

export interface OrderResult {
  id: number;
  reference: string;
  customer_name: string;
  total_amount: number;
  status: string;
  items_count: number;
}

// ── API Calls ─────────────────────────────────────────────

export async function fetchStoreInfo(slug: string): Promise<StoreInfo> {
  const res = await storefrontApi.get(`/storefront/${slug}`);
  return res.data.data;
}

export async function fetchStoreProducts(
  slug: string
): Promise<StorefrontProduct[]> {
  const res = await storefrontApi.get(`/storefront/${slug}/products`);
  return res.data.data;
}

export async function placeStorefrontOrder(
  slug: string,
  payload: PlaceOrderPayload
): Promise<OrderResult> {
  const res = await storefrontApi.post(`/storefront/${slug}/orders`, payload);
  return res.data.data;
}
