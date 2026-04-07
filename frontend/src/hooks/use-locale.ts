// ============================================================
// COD CRM — useLocale Hook
// ============================================================

"use client";

import { useCallback } from "react";
import { useUIStore } from "@/stores";
import type { Locale } from "@/lib/constants";

// Simple client-side translation dictionaries
// Full i18n (next-intl) can be wired in later.
const dictionaries: Record<Locale, Record<string, string>> = {
  en: {},
  fr: {},
  ar: {},
};

// Lazy-load locale dictionaries
async function loadDictionary(locale: Locale): Promise<Record<string, string>> {
  try {
    const dict = await import(`../../../public/locales/${locale}.json`);
    dictionaries[locale] = dict.default || dict;
    return dictionaries[locale];
  } catch {
    return {};
  }
}

export function useLocale() {
  const { locale, setLocale } = useUIStore();

  const isRTL = locale === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  const t = useCallback(
    (key: string, fallback?: string): string => {
      return dictionaries[locale]?.[key] || fallback || key;
    },
    [locale]
  );

  const changeLocale = useCallback(
    async (newLocale: Locale) => {
      await loadDictionary(newLocale);
      setLocale(newLocale);

      // Update document direction
      if (typeof document !== "undefined") {
        document.documentElement.dir = newLocale === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = newLocale;
      }
    },
    [setLocale]
  );

  return {
    locale,
    isRTL,
    dir,
    t,
    changeLocale,
  };
}
