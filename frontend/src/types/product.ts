// ============================================================
// COD CRM — Product & Inventory Types
// ============================================================

export interface Product {
  id: number;
  store_id: number;
  name: string;
  sku: string | null;
  description: string | null;
  price: number;
  cost_price: number;
  weight: number;
  category: string | null;
  image_url: string | null;
  status: "active" | "inactive" | "draft";
  stock_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  name: string;
  sku?: string;
  description?: string;
  price: number;
  cost_price?: number;
  weight?: number;
  category?: string;
  image_url?: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  sku: string | null;
  price: number;
  category: string | null;
  status: string;
  stock_quantity: number;
  stock_updated_at: string | null;
}

export interface InventoryAdjustPayload {
  product_id: number;
  quantity: number;
  type: "add" | "subtract" | "set";
  reason?: string;
}

export interface InventoryMovement {
  id: number;
  store_id: number;
  product_id: number;
  type: "add" | "subtract" | "set";
  quantity: number;
  previous_qty: number;
  new_qty: number;
  reason: string | null;
  performed_by: number | null;
  performed_by_name: string | null;
  created_at: string;
}
