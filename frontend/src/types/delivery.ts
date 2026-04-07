// ============================================================
// COD CRM — Delivery & Return Types
// ============================================================

export type DeliveryStatus =
  | "pending"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "returned"
  | "failed";

export interface Delivery {
  id: number;
  store_id: number;
  order_id: number;
  order_reference: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  wilaya_name: string | null;
  delivery_partner: string;
  tracking_number: string | null;
  status: DeliveryStatus;
  shipping_cost: number;
  notes: string | null;
  created_by: number | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ReturnReason =
  | "customer_refused"
  | "wrong_address"
  | "not_reachable"
  | "damaged"
  | "wrong_product"
  | "duplicate"
  | "other";

export type ReturnStatus = "pending" | "processing" | "completed" | "restocked";

export interface Return {
  id: number;
  store_id: number;
  order_id: number;
  order_reference: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  wilaya_name: string | null;
  reason: ReturnReason;
  notes: string | null;
  status: ReturnStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}
