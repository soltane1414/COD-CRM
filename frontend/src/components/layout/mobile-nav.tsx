"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Truck,
  RotateCcw,
  BarChart3,
  Users,
  Settings,
  Calculator,
  Brain,
  ShieldAlert,
  PieChart,
  TrendingUp,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import type { UserRole } from "@/types/auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: UserRole[];
  separator?: boolean;
}

const navItems: NavItem[] = [
  { label: "nav.dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "nav.orders", href: "/dashboard/orders", icon: <ShoppingCart className="h-5 w-5" />, roles: ["owner", "admin", "order_confirmator"] },
  { label: "nav.products", href: "/dashboard/products", icon: <Package className="h-5 w-5" />, roles: ["owner", "admin", "inventory_manager"] },
  { label: "nav.inventory", href: "/dashboard/inventory", icon: <Warehouse className="h-5 w-5" />, roles: ["owner", "admin", "inventory_manager"] },
  { label: "nav.deliveries", href: "/dashboard/deliveries", icon: <Truck className="h-5 w-5" />, roles: ["owner", "admin", "delivery_manager"] },
  { label: "nav.returns", href: "/dashboard/returns", icon: <RotateCcw className="h-5 w-5" />, roles: ["owner", "admin", "delivery_manager"] },
  { label: "nav.analytics", href: "/dashboard/analytics", icon: <BarChart3 className="h-5 w-5" />, roles: ["owner", "admin", "accountant"] },
  { label: "nav.accounting", href: "/dashboard/accounting", icon: <Calculator className="h-5 w-5" />, roles: ["owner", "admin", "accountant"] },
  { label: "nav.users", href: "/dashboard/users", icon: <Users className="h-5 w-5" />, roles: ["owner", "admin"] },
  { label: "nav.settings", href: "/dashboard/settings", icon: <Settings className="h-5 w-5" />, roles: ["owner", "admin"] },
  // AI section
  { label: "nav.ai_dashboard", href: "/dashboard/ai", icon: <Brain className="h-5 w-5" />, roles: ["owner", "admin"], separator: true },
  { label: "nav.risk_prediction", href: "/dashboard/risk", icon: <ShieldAlert className="h-5 w-5" />, roles: ["owner", "admin"] },
  { label: "nav.segments", href: "/dashboard/segments", icon: <PieChart className="h-5 w-5" />, roles: ["owner", "admin"] },
  { label: "nav.forecast", href: "/dashboard/forecast", icon: <TrendingUp className="h-5 w-5" />, roles: ["owner", "admin"] },
  { label: "nav.insights", href: "/dashboard/insights", icon: <Lightbulb className="h-5 w-5" />, roles: ["owner", "admin"] },
  { label: "nav.retrain", href: "/dashboard/retrain", icon: <RefreshCw className="h-5 w-5" />, roles: ["owner", "admin"] },
];

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

export function MobileNav({ isOpen, onClose, t }: MobileNavProps) {
  const pathname = usePathname();
  const { user, store, hasRole } = useAuth();

  const filteredItems = navItems.filter(
    (item) => !item.roles || item.roles.some((role) => hasRole(role))
  );

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 w-72 bg-sidebar-bg transition-transform duration-300 ease-in-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              {store?.name || "COD CRM"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {filteredItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <div key={item.href}>
                {item.separator && (
                  <div className="my-2 mx-2 border-t border-border">
                    <p className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      AI
                    </p>
                  </div>
                )}
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-active text-sidebar-active-foreground"
                      : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {item.icon}
                  <span>{t(item.label)}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User */}
        {user && (
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3">
              <Avatar fallback={user.name} size="sm" />
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.role}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
