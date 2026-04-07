// ============================================================
// COD CRM — API Response Types
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export interface Wilaya {
  id: number;
  code: string;
  name: string;
  ar_name: string;
  shipping_zone: "zone_1" | "zone_2" | "zone_3";
}

// Re-export all types from a single barrel
export * from "./auth";
export * from "./order";
export * from "./product";
export * from "./delivery";
export * from "./analytics";
