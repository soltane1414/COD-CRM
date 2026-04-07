"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/providers/i18n-provider";
import { StatCard } from "@/components/shared/stat-card";
import { PageLoader } from "@/components/shared/loading";
import apiClient from "@/lib/api/client";
import type { DashboardStats } from "@/types/analytics";
import {
  ShoppingCart,
  DollarSign,
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  Truck,
  RotateCcw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiClient.get("/analytics/dashboard");
        setStats(res.data.data);
      } catch {
        // Fallback — will show empty state
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("dashboard.welcome").replace("{name}", user?.name || "")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.title")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("dashboard.total_orders")}
          value={stats?.total_orders ?? 0}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          title={t("dashboard.total_revenue")}
          value={formatCurrency(stats?.total_revenue ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title={t("dashboard.total_products")}
          value={stats?.total_products ?? 0}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          title={t("dashboard.total_users")}
          value={stats?.total_users ?? 0}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("dashboard.pending_orders")}
          value={stats?.pending_orders ?? 0}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          title={t("dashboard.delivery_rate")}
          value={`${stats?.delivery_rate ?? 0}%`}
          icon={<Truck className="h-5 w-5" />}
          trend={
            stats?.delivery_rate
              ? { value: stats.delivery_rate, isPositive: stats.delivery_rate > 50 }
              : undefined
          }
        />
        <StatCard
          title={t("dashboard.return_rate")}
          value={`${stats?.return_rate ?? 0}%`}
          icon={<RotateCcw className="h-5 w-5" />}
          trend={
            stats?.return_rate
              ? { value: stats.return_rate, isPositive: false }
              : undefined
          }
        />
        <StatCard
          title={t("dashboard.confirmation_rate")}
          value={`${stats?.confirmation_rate ?? 0}%`}
          icon={
            (stats?.confirmation_rate ?? 0) > 50 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )
          }
        />
      </div>
    </div>
  );
}
