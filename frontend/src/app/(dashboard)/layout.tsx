"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useI18n } from "@/providers/i18n-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { sidebarCollapsed } = useUIStore();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar t={t} />

      {/* Mobile Nav */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        t={t}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          "lg:ms-[var(--sidebar-width)]",
          sidebarCollapsed && "lg:ms-[var(--sidebar-collapsed-width)]"
        )}
      >
        <Topbar t={t} onMenuClick={() => setIsMobileNavOpen(true)} />

        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
