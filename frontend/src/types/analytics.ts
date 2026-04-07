// ============================================================
// COD CRM — Analytics Types
// ============================================================

export interface DashboardStats {
  total_orders: number;
  total_revenue: number;
  total_products: number;
  total_users: number;
  pending_orders: number;
  delivery_rate: number;
  return_rate: number;
  confirmation_rate: number;
  average_order_value: number;
  orders_by_status: StatusCount[];
  new_orders_today: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface WilayaAnalytics {
  wilaya_id: number;
  wilaya_name: string;
  wilaya_ar_name: string;
  total_orders: number;
  delivered_count: number;
  returned_count: number;
  revenue: number;
  return_rate: number;
}

export interface TopProduct {
  id: number;
  name: string;
  sku: string;
  price: number;
  total_sold: number;
  total_revenue: number;
  order_count: number;
}

export interface RevenueDataPoint {
  period: string;
  order_count: number;
  revenue: number;
  collected_revenue: number;
  total_cost: number;
}

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "12m";
