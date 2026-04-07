// ============================================================
// COD CRM — UI Store (Zustand)
// ============================================================
// Controls sidebar state, theme, and locale.
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/constants";

type Theme = "light" | "dark" | "system";

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapse: () => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Locale
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarOpen: false,
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebarCollapse: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // Theme
      theme: "system",
      setTheme: (theme) => set({ theme }),

      // Locale
      locale: "fr",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "cod-crm-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        locale: state.locale,
      }),
    }
  )
);
