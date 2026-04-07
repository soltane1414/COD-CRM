"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/api/client";
import { StatCard } from "@/components/shared/stat-card";
import { PageLoader } from "@/components/shared/loading";
import { Store, Users, ShoppingCart, TrendingUp } from "lucide-react";

interface PlatformStats {
  total_stores: number;
  active_stores: number;
  suspended_stores: number;
  total_users: number;
  total_orders: number;
  total_revenue: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get("/admin/stats");
      setStats(res.data.data);
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Super Admin</h1>
        <p className="text-sm text-slate-400">Vue d&apos;ensemble de la plateforme COD CRM</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Stores"
          value={stats?.total_stores ?? 0}
          icon={<Store className="h-5 w-5" />}
        />
        <StatCard
          title="Active Stores"
          value={stats?.active_stores ?? 0}
          icon={<Store className="h-5 w-5" />}
          trend={
            stats
              ? { value: Math.round((stats.active_stores / Math.max(stats.total_stores, 1)) * 100), isPositive: true }
              : undefined
          }
        />
        <StatCard
          title="Total Users"
          value={stats?.total_users ?? 0}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Total Orders"
          value={stats?.total_orders ?? 0}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Suspended Stores"
          value={stats?.suspended_stores ?? 0}
          icon={<Store className="h-5 w-5" />}
          trend={
            stats?.suspended_stores
              ? { value: stats.suspended_stores, isPositive: false }
              : undefined
          }
        />
        <StatCard
          title="Revenue (Platform)"
          value={`${(stats?.total_revenue ?? 0).toLocaleString()} DA`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}
