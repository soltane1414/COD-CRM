export { ROLES, ROLE_OPTIONS } from "./roles";
export { ORDER_STATUSES, ORDER_STATUS_OPTIONS, STATUS_TRANSITIONS } from "./statuses";
export { WILAYAS, WILAYA_MAP } from "./wilayas";

// ── App-level constants ───────────────────────────────────
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "COD CRM";
export const SUPPORTED_LOCALES = ["ar", "fr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = (process.env.NEXT_PUBLIC_DEFAULT_LOCALE as Locale) || "fr";
export const DEFAULT_CURRENCY = "DZD";
export const DEFAULT_TIMEZONE = "Africa/Algiers";
export const DEFAULT_PER_PAGE = 25;
