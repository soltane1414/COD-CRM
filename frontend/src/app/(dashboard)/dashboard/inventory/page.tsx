"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/providers/i18n-provider";
import apiClient from "@/lib/api/client";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertTriangle, Search, Package, History } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { InventoryItem, InventoryMovement } from "@/types/product";
import type { PaginationMeta } from "@/types";

export default function InventoryPage() {
  const { t } = useI18n();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Adjust stock modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [adjustForm, setAdjustForm] = useState({
    product_id: "",
    quantity: "",
    type: "",
    reason: "",
  });

  // History modal
  const [showHistory, setShowHistory] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "15");
      if (search) params.set("search", search);

      const [invRes, lowRes] = await Promise.all([
        apiClient.get(`/inventory?${params.toString()}`),
        apiClient.get("/inventory/alerts"),
      ]);
      setInventory(invRes.data.data);
      setMeta(invRes.data.meta);
      setLowStock(lowRes.data.data || []);
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Adjust stock handlers
  const openAdjust = (item?: InventoryItem) => {
    setShowAdjust(true);
    setAdjustMsg("");
    setFormErrors({});
    if (item) {
      setAdjustForm({ product_id: String(item.id), quantity: "", type: "", reason: "" });
    } else {
      setAdjustForm({ product_id: "", quantity: "", type: "", reason: "" });
    }
  };

  const closeAdjust = () => {
    setShowAdjust(false);
    setAdjustForm({ product_id: "", quantity: "", type: "", reason: "" });
    setFormErrors({});
    setAdjustMsg("");
  };

  const handleAdjustChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAdjustForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAdjustSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!adjustForm.product_id) errors.product_id = t("inventory.error_product_required");
    if (!adjustForm.quantity || isNaN(Number(adjustForm.quantity))) errors.quantity = t("inventory.error_quantity_required");
    if (!adjustForm.type) errors.type = t("inventory.error_type_required");
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    setAdjustMsg("");
    try {
      await apiClient.post("/inventory/adjust", {
        product_id: parseInt(adjustForm.product_id),
        quantity: parseInt(adjustForm.quantity),
        type: adjustForm.type,
        reason: adjustForm.reason.trim() || undefined,
      });
      setAdjustMsg(t("inventory.success_adjust"));
      fetchInventory();
      setTimeout(closeAdjust, 1200);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || t("inventory.error_adjust");
      setFormErrors({ submit: msg });
    } finally {
      setSaving(false);
    }
  };

  // History handlers
  const openHistory = async (item: InventoryItem) => {
    setHistoryItem(item);
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await apiClient.get(`/inventory/${item.id}/history`);
      setMovements(res.data.data || []);
    } catch {
      setMovements([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Sorting & Filtering ───────────────────────────
  const categories = Array.from(new Set(inventory.map((i) => i.category).filter(Boolean))) as string[];

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = categoryFilter
    ? inventory.filter((i) => i.category === categoryFilter)
    : inventory;

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[sortKey];
        const bv = (b as unknown as Record<string, unknown>)[sortKey];
        if (typeof av === "string" && typeof bv === "string") {
          return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        const na = typeof av === "number" ? av : Number(av) || 0;
        const nb = typeof bv === "number" ? bv : Number(bv) || 0;
        return sortDir === "asc" ? na - nb : nb - na;
      })
    : filtered;

  const productOptions = inventory.map((item) => ({
    value: String(item.id),
    label: item.name + (item.sku ? ` (${item.sku})` : ""),
  }));

  const typeOptions = [
    { value: "add", label: t("inventory.type.add") },
    { value: "subtract", label: t("inventory.type.subtract") },
    { value: "set", label: t("inventory.type.set") },
  ];

  const movementColumns: Column<InventoryMovement>[] = [
    {
      key: "type",
      header: t("inventory.movement_type"),
      render: (m) => (
        <Badge variant={m.type === "add" ? "success" : m.type === "subtract" ? "destructive" : "default"}>
          {t(`inventory.type.${m.type}`)}
        </Badge>
      ),
    },
    { key: "quantity", header: t("inventory.quantity") },
    { key: "previous_qty", header: t("inventory.previous_qty") },
    { key: "new_qty", header: t("inventory.new_qty") },
    { key: "reason", header: t("inventory.reason"), render: (m) => m.reason || "—" },
    { key: "performed_by_name", header: t("inventory.performed_by"), render: (m) => m.performed_by_name || "—" },
    { key: "created_at", header: t("inventory.date"), render: (m) => formatDate(m.created_at) },
  ];

  const columns: Column<InventoryItem>[] = [
    { key: "name", header: t("inventory.product"), sortable: true },
    { key: "sku", header: t("inventory.sku"), render: (item) => item.sku || "—" },
    { key: "category", header: t("inventory.category"), sortable: true, render: (item) => item.category || "—" },
    {
      key: "stock_quantity",
      header: t("inventory.quantity"),
      sortable: true,
      render: (item) => (
        <span
          className={
            item.stock_quantity <= 10
              ? "font-semibold text-destructive"
              : "font-medium"
          }
        >
          {item.stock_quantity}
        </span>
      ),
    },
    {
      key: "status",
      header: t("inventory.status"),
      render: (item) => (
        <Badge variant={item.status === "active" ? "success" : "muted"}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      className: "w-28",
      render: (item) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openAdjust(item)}>
            <Package className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openHistory(item)}>
            <History className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {t("inventory.title")}
        </h1>
        <Button onClick={() => openAdjust()}>
          <Package className="h-4 w-4" />
          {t("inventory.adjust_stock")}
        </Button>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <Card className="border-warning">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              {t("inventory.low_stock")} ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((item) => (
                <Badge key={item.id} variant="warning">
                  {item.name}: {item.stock_quantity}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="ps-9"
          />
        </div>
        {categories.length > 0 && (
          <Select
            options={[
              { value: "", label: t("products.all_categories") || "Toutes les catégories" },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-48"
          />
        )}
      </div>

      <DataTable
        columns={columns}
        data={sorted}
        isLoading={isLoading}
        emptyMessage={t("no_results")}
        rowKey={(item) => item.id}
        sortKey={sortKey}
        sortDirection={sortDir}
        onSort={handleSort}
      />

      {meta && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          onPageChange={setPage}
        />
      )}

      {/* Adjust Stock Modal */}
      <Modal isOpen={showAdjust} onClose={closeAdjust} title={t("inventory.adjust_stock")} size="md">
        <div className="space-y-4">
          <Select
            label={t("inventory.product") + " *"}
            name="product_id"
            value={adjustForm.product_id}
            onChange={handleAdjustChange}
            options={productOptions}
            placeholder={t("inventory.select_product")}
            error={formErrors.product_id}
          />
          <Select
            label={t("inventory.movement_type") + " *"}
            name="type"
            value={adjustForm.type}
            onChange={handleAdjustChange}
            options={typeOptions}
            placeholder={t("inventory.select_type")}
            error={formErrors.type}
          />
          <Input
            label={t("inventory.quantity") + " *"}
            name="quantity"
            type="number"
            min="1"
            value={adjustForm.quantity}
            onChange={handleAdjustChange}
            error={formErrors.quantity}
          />
          <Input
            label={t("inventory.reason")}
            name="reason"
            value={adjustForm.reason}
            onChange={handleAdjustChange}
          />

          {formErrors.submit && <p className="text-sm text-destructive">{formErrors.submit}</p>}
          {adjustMsg && <p className="text-sm text-green-600">{adjustMsg}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeAdjust}>{t("cancel")}</Button>
            <Button onClick={handleAdjustSubmit} isLoading={saving}>{t("confirm")}</Button>
          </div>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)} title={`${t("inventory.history")} — ${historyItem?.name || ""}`} size="xl">
        <div className="max-h-[60vh] overflow-y-auto">
          <DataTable
            columns={movementColumns}
            data={movements}
            isLoading={loadingHistory}
            emptyMessage={t("no_results")}
            rowKey={(m) => m.id}
          />
        </div>
      </Modal>
    </div>
  );
}
