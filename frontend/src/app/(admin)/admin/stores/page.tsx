"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/shared/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Store as StoreIcon, Search, Ban, CheckCircle, Calendar, Users } from "lucide-react";
import type { Store } from "@/types/auth";
import type { PaginationMeta } from "@/types";

interface AdminStore extends Store {
  users_count: number;
  orders_count: number;
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toggleStore, setToggleStore] = useState<AdminStore | null>(null);

  const fetchStores = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "15",
        ...(search && { search }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });
      const res = await apiClient.get(`/admin/stores?${params}`);
      setStores(res.data.data);
      setMeta(res.data.meta);
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const handleToggleStatus = async () => {
    if (!toggleStore) return;
    const newStatus = toggleStore.status === "active" ? "suspended" : "active";
    try {
      await apiClient.patch(`/admin/stores/${toggleStore.id}/status`, { status: newStatus });
      setToggleStore(null);
      fetchStores();
    } catch {
      // handle error
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="success">Actif</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspendu</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactif</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestion des Stores</h1>
          <p className="text-sm text-slate-400">
            {meta ? `${meta.total} store(s) au total` : "Chargement..."}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un store..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900 border-white/10 pl-10 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-2">
          {["all", "active", "suspended", "inactive"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-indigo-600 text-white"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {s === "all" ? "Tous" : s === "active" ? "Actif" : s === "suspended" ? "Suspendu" : "Inactif"}
            </button>
          ))}
        </div>
      </div>

      {/* Store List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
              <Skeleton className="h-6 w-48 bg-white/10" />
              <Skeleton className="mt-2 h-4 w-32 bg-white/10" />
            </div>
          ))
        ) : stores.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/50 py-16 text-center">
            <StoreIcon className="mx-auto mb-3 h-10 w-10 text-slate-600" />
            <p className="text-slate-400">Aucun store trouvé</p>
          </div>
        ) : (
          stores.map((store) => (
            <div
              key={store.id}
              className="flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-900/50 p-5 transition-colors hover:border-white/20 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400">
                  <StoreIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{store.name}</h3>
                    {getStatusBadge(store.status)}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-400">{store.slug}.teachpublic.com</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {store.users_count} utilisateur(s)
                    </span>
                    <span className="flex items-center gap-1">
                      <ShoppingCartIcon className="h-3.5 w-3.5" />
                      {store.orders_count} commande(s)
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(store.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {store.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setToggleStore(store)}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <Ban className="mr-1.5 h-4 w-4" />
                    Suspendre
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setToggleStore(store)}
                    className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Activer
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          onPageChange={setPage}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!toggleStore}
        onClose={() => setToggleStore(null)}
        onConfirm={handleToggleStatus}
        title={
          toggleStore?.status === "active"
            ? "Suspendre ce store ?"
            : "Activer ce store ?"
        }
        message={
          toggleStore?.status === "active"
            ? `Le store "${toggleStore?.name}" sera suspendu et ses utilisateurs ne pourront plus y accéder.`
            : `Le store "${toggleStore?.name}" sera réactivé.`
        }
        confirmText={toggleStore?.status === "active" ? "Suspendre" : "Activer"}
        variant={toggleStore?.status === "active" ? "destructive" : "default"}
      />
    </div>
  );
}

// Small icon component to avoid name clash with imported Store
function ShoppingCartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
    </svg>
  );
}
