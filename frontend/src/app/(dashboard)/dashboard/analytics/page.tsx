"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/providers/i18n-provider";
import apiClient from "@/lib/api/client";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/shared/loading";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  MapPin,
  Package,
  RotateCcw,
  ShoppingCart,
  Clock,
} from "lucide-react";
import type {
  DashboardStats,
  WilayaAnalytics,
  TopProduct,
  AnalyticsPeriod,
} from "@/types/analytics";

export default function AnalyticsPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [wilayaData, setWilayaData] = useState<WilayaAnalytics[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [dashRes, wilayaRes, prodRes] = await Promise.all([
          apiClient.get(`/analytics/dashboard?period=${period}`),
          apiClient.get(`/analytics/wilayas?period=${period}`),
          apiClient.get(`/analytics/products?period=${period}`),
        ]);
        setStats(dashRes.data.data);
        setWilayaData(wilayaRes.data.data || []);
        setTopProducts(prodRes.data.data || []);
      } catch {
        // handle
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [period]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {t("analytics.title")}
        </h1>
        <Select
          options={[
            { value: "7d", label: t("analytics.period.day") },
            { value: "30d", label: t("analytics.period.week") },
            { value: "90d", label: t("analytics.period.month") },
          ]}
          value={period}
          onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
          className="w-40"
        />
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("dashboard.total_orders")}
          value={stats?.total_orders ?? 0}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          title={t("dashboard.total_revenue")}
          value={formatCurrency(stats?.total_revenue ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title={t("dashboard.delivery_rate")}
          value={formatPercent(stats?.delivery_rate ?? 0)}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          title={t("dashboard.return_rate")}
          value={formatPercent(stats?.return_rate ?? 0)}
          icon={<RotateCcw className="h-5 w-5" />}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t("dashboard.pending_orders")}
          value={stats?.pending_orders ?? 0}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title={t("dashboard.confirmation_rate")}
          value={formatPercent(stats?.confirmation_rate ?? 0)}
        />
        <StatCard
          title={t("dashboard.total_products")}
          value={stats?.total_products ?? 0}
          icon={<Package className="h-5 w-5" />}
        />
      </div>

      {/* Order Status Breakdown */}
      {stats?.orders_by_status && stats.orders_by_status.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t("analytics.orders_analytics")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.orders_by_status.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <Badge variant="secondary">
                    {t(`orders.status.${item.status}`)}
                  </Badge>
                  <span className="text-lg font-bold">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("analytics.top_products")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_results")}</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((product, i) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium">
                        {product.name}
                      </span>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-semibold">
                        {t("analytics.total_sold", { count: product.total_sold })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(product.total_revenue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wilaya Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t("analytics.wilaya_analytics")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wilayaData.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_results")}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {wilayaData.slice(0, 15).map((w) => (
                  <div
                    key={w.wilaya_id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <span className="text-sm font-medium">{w.wilaya_name}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span>
                        {t("analytics.orders_count")}: <strong>{w.total_orders}</strong>
                      </span>
                      <span className="text-success">
                        ✓ {w.delivered_count}
                      </span>
                      <span className="text-destructive">
                        ↩ {formatPercent(w.return_rate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
