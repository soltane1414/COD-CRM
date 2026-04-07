"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/providers/i18n-provider";
import apiClient from "@/lib/api/client";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { PageLoader } from "@/components/shared/loading";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  BarChart3,
  ShoppingCart,
} from "lucide-react";
import type { AnalyticsPeriod, RevenueDataPoint } from "@/types/analytics";

export default function AccountingPage() {
  const { t } = useI18n();
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [collectedRevenue, setCollectedRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [deliveredOrders, setDeliveredOrders] = useState(0);
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [revRes, dashRes] = await Promise.all([
          apiClient.get(`/analytics/revenue?period=${period}`),
          apiClient.get(`/analytics/dashboard?period=${period}`),
        ]);
        const revenueData: RevenueDataPoint[] = revRes.data.data || [];
        setRevenue(revenueData);

        const dashData = dashRes.data.data;
        setTotalRevenue(dashData?.total_revenue || 0);
        setTotalOrders(dashData?.total_orders || 0);

        // Use actual costs from revenue data (total_cost comes from products cost_price)
        // Use Number() to prevent string concatenation when API returns numeric strings
        const cost = revenueData.reduce(
          (sum: number, p: RevenueDataPoint) => sum + (Number(p.total_cost) || 0),
          0
        );
        setTotalCost(cost);

        // Collected revenue (from delivered orders only)
        const collected = revenueData.reduce(
          (sum: number, p: RevenueDataPoint) => sum + (Number(p.collected_revenue) || 0),
          0
        );
        setCollectedRevenue(collected);

        // Count delivered orders from status breakdown
        const delivered = dashData?.orders_by_status?.find((s: { status: string; count: number }) => s.status === "delivered")?.count || 0;
        setDeliveredOrders(delivered);
      } catch {
        // handle
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [period]);

  if (isLoading) return <PageLoader />;

  const profit = collectedRevenue - totalCost;
  const margin = collectedRevenue > 0 ? Math.round((profit / collectedRevenue) * 100) : 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {t("accounting.title")}
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

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("analytics.revenue")}
          value={formatCurrency(collectedRevenue)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title={t("accounting.product_costs")}
          value={formatCurrency(totalCost)}
          icon={<CreditCard className="h-5 w-5" />}
        />
        <StatCard
          title={t("accounting.profit")}
          value={formatCurrency(profit)}
          icon={
            profit >= 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )
          }
          trend={{
            value: margin,
            isPositive: profit >= 0,
          }}
        />
        <StatCard
          title={t("accounting.transactions")}
          value={totalOrders}
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      {/* Extra metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t("dashboard.total_revenue")}
          value={formatCurrency(totalRevenue)}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          title={t("analytics.delivered_count")}
          value={deliveredOrders}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title={t("accounting.avg_order_value")}
          value={formatCurrency(avgOrderValue)}
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      {/* Margin Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("accounting.margin")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${margin >= 0 ? "bg-green-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(Math.abs(margin), 100)}%` }}
              />
            </div>
            <span className={`text-lg font-bold ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
              {margin}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>{t("accounting.revenue_timeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_results")}</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {revenue.map((point, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-border px-4 py-3 gap-2"
                >
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">
                    {point.period}
                  </span>
                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {point.order_count} {t("analytics.orders_count").toLowerCase()}
                    </span>
                    <span className="text-sm font-semibold text-success whitespace-nowrap">
                      {formatCurrency(point.collected_revenue)}
                    </span>
                    {point.total_cost > 0 && (
                      <span className="text-sm text-destructive whitespace-nowrap">
                        -{formatCurrency(point.total_cost)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
