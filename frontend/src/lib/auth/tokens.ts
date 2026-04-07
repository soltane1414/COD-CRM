// ============================================================
// COD CRM — Token Storage Helpers
// ============================================================
// Uses cookies for access_token (httpOnly in production via API)
// and localStorage for refresh_token (client-side refresh flow).
// ============================================================

import Cookies from "js-cookie";

const ACCESS_TOKEN_KEY = "cod_crm_access_token";
const REFRESH_TOKEN_KEY = "cod_crm_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return Cookies.get(ACCESS_TOKEN_KEY) || null;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") return;

  // Access token in cookie (1 hour expiry)
  Cookies.set(ACCESS_TOKEN_KEY, accessToken, {
    expires: 1 / 24, // 1 hour
    sameSite: "lax",
    secure: window.location.protocol === "https:",
  });

  // Refresh token in localStorage (7 days — managed by JWT expiry)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  Cookies.remove(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("store_id");
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
