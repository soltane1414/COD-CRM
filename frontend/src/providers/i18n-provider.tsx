"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useUIStore } from "@/stores/ui-store";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/lib/constants";

type Locale = (typeof SUPPORTED_LOCALES)[number];
type Dictionary = Record<string, string>;

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  dictionary: Dictionary;
  t: (key: string, params?: Record<string, string | number>) => string;
  changeLocale: (locale: Locale) => void;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const RTL_LOCALES: Locale[] = ["ar"];

async function loadDictionary(locale: Locale): Promise<Dictionary> {
  try {
    const res = await fetch(`/locales/${locale}.json`);
    if (!res.ok) throw new Error(`Failed to load locale: ${locale}`);
    return res.json();
  } catch {
    // Fallback to empty dict
    console.warn(`Could not load locale file for: ${locale}`);
    return {};
  }
}

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const storeLocale = useUIStore((s) => s.locale) as Locale;
  const setStoreLocale = useUIStore((s) => s.setLocale);
  const [dictionary, setDictionary] = useState<Dictionary>({});
  const [isLoading, setIsLoading] = useState(true);

  const locale: Locale = SUPPORTED_LOCALES.includes(storeLocale)
    ? storeLocale
    : DEFAULT_LOCALE;
  const dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";

  // Load dictionary when locale changes
  useEffect(() => {
    loadDictionary(locale).then((dict) => {
      setDictionary(dict);
      setIsLoading(false);
    });
  }, [locale]);

  // Sync document direction and lang
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [dir, locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = dictionary[key] || key;

      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }

      return value;
    },
    [dictionary]
  );

  const changeLocale = useCallback(
    (newLocale: Locale) => {
      setStoreLocale(newLocale);
    },
    [setStoreLocale]
  );

  return (
    <I18nContext.Provider
      value={{ locale, dir, dictionary, t, changeLocale, isLoading }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
