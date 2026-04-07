"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Search, Users, Store, Calendar } from "lucide-react";
import type { User } from "@/types/auth";
import type { PaginationMeta } from "@/types";

interface AdminUser extends User {
  store_name?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
        ...(search && { search }),
      });
      const res = await apiClient.get(`/admin/users?${params}`);
      setUsers(res.data.data);
      setMeta(res.data.meta);
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      super_admin: "bg-red-500/10 text-red-400 border-red-500/30",
      owner: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      admin: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      order_confirmator: "bg-green-500/10 text-green-400 border-green-500/30",
      inventory_manager: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      accountant: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      delivery_manager: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    };
    const roleLabels: Record<string, string> = {
      super_admin: "Super Admin",
      owner: "Propriétaire",
      admin: "Admin",
      order_confirmator: "Confirmateur",
      inventory_manager: "Stock",
      accountant: "Comptable",
      delivery_manager: "Livraison",
    };
    return (
      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleColors[role] || ""}`}>
        {roleLabels[role] || role}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Gestion des Utilisateurs</h1>
        <p className="text-sm text-slate-400">
          {meta ? `${meta.total} utilisateur(s) au total` : "Chargement..."}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="bg-slate-900 border-white/10 pl-10 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-900/80">
            <tr>
              <th className="px-5 py-3.5 font-medium text-slate-400">Utilisateur</th>
              <th className="px-5 py-3.5 font-medium text-slate-400">Store</th>
              <th className="px-5 py-3.5 font-medium text-slate-400">Rôle</th>
              <th className="px-5 py-3.5 font-medium text-slate-400">Statut</th>
              <th className="px-5 py-3.5 font-medium text-slate-400">Inscrit le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4"><Skeleton className="h-5 w-40 bg-white/10" /></td>
                  <td className="px-5 py-4"><Skeleton className="h-5 w-28 bg-white/10" /></td>
                  <td className="px-5 py-4"><Skeleton className="h-5 w-20 bg-white/10" /></td>
                  <td className="px-5 py-4"><Skeleton className="h-5 w-16 bg-white/10" /></td>
                  <td className="px-5 py-4"><Skeleton className="h-5 w-24 bg-white/10" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <Users className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-slate-400">Aucun utilisateur trouvé</p>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar fallback={user.name} size="sm" />
                      <div>
                        <p className="font-medium text-white">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {user.store_name ? (
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <Store className="h-3.5 w-3.5 text-slate-500" />
                        {user.store_name}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">{getRoleBadge(user.role)}</td>
                  <td className="px-5 py-4">
                    {user.status === "active" ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="secondary">Inactif</Badge>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(user.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
