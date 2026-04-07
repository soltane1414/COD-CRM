"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { PageLoader } from "@/components/shared/loading";
import { cn } from "@/lib/utils";
import {
  Store,
  Users,
  LayoutDashboard,
  LogOut,
  Shield,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: "/admin/stores", label: "Stores", icon: <Store className="h-5 w-5" /> },
  { href: "/admin/users", label: "Users", icon: <Users className="h-5 w-5" /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout, adminFetchProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Allow /admin/login to render without auth checks
  const isAdminLoginPage = pathname === "/admin/login" || pathname === "/admin/login/";

  useEffect(() => {
    if (!isAdminLoginPage && !isLoading && !isAuthenticated) {
      router.push("/admin/login/");
    }
  }, [isLoading, isAuthenticated, router, isAdminLoginPage]);

  useEffect(() => {
    if (isAuthenticated && !user && !isAdminLoginPage) {
      adminFetchProfile();
    }
  }, [isAuthenticated, user, adminFetchProfile, isAdminLoginPage]);

  // If we're on the admin login page, just render children (no sidebar)
  if (isAdminLoginPage) {
    return <>{children}</>;
  }

  // Still loading auth state — show loader, don't redirect
  if (isLoading) return <PageLoader />;

  // Not authenticated after loading finished — redirect handled by effect above
  if (!isAuthenticated) return <PageLoader />;

  // Authenticated but user not yet loaded
  if (!user) return <PageLoader />;

  if (user.role !== "super_admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <h1 className="mb-2 text-2xl font-bold">Accès refusé</h1>
          <p className="mb-6 text-slate-400">
            Cette zone est réservée aux super administrateurs.
          </p>
          <Link
            href="/dashboard"
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Retour au dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 flex w-64 flex-col border-e border-white/10 bg-slate-900">
        {/* Header */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Super Admin</p>
            <p className="text-xs text-slate-400">COD CRM</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3">
          {adminNav.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-600/20 text-indigo-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar fallback={user.name} size="sm" />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push("/"); }}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
