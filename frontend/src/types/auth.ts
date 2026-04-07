// ============================================================
// COD CRM — Global TypeScript Types
// ============================================================

// ── Roles ─────────────────────────────────────────────────
export type UserRole =
  | "super_admin"
  | "owner"
  | "admin"
  | "order_confirmator"
  | "inventory_manager"
  | "accountant"
  | "delivery_manager";

// ── User ──────────────────────────────────────────────────
export interface User {
  id: number;
  store_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: "active" | "inactive";
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

// ── Store ─────────────────────────────────────────────────
export interface Store {
  id: number;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  currency: string;
  timezone: string;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
}

// ── Auth ──────────────────────────────────────────────────
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginPayload {
  email: string;
  password: string;
  store_id?: number;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  store_name: string;
}

export interface AuthResponse {
  user: User;
  store?: Store;
  tokens: AuthTokens;
}
