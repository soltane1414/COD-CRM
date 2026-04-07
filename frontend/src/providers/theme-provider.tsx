"use client";

import { useEffect, type ReactNode } from "react";
import { useUIStore } from "@/stores/ui-store";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * ThemeProvider — Applies dark/light/system theme class to <html>.
 * Syncs Zustand persisted theme with the DOM.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (resolved: "light" | "dark") => {
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
    };

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(media.matches ? "dark" : "light");

      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? "dark" : "light");
      };
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }

    applyTheme(theme);
  }, [theme]);

  return <>{children}</>;
}
