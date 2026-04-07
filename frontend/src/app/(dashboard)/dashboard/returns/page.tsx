"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/providers/i18n-provider";
import apiClient from "@/lib/api/client";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Return, ReturnReason, ReturnStatus } from "@/types/delivery";
import type { Order } from "@/types/order";
import type { PaginationMeta } from "@/types";

const returnVariant: Record<string, "default" | "warning" | "success" | "destructive" | "muted"> = {
  pending: "warning",
  processing: "default",
  completed: "success",
  restocked: "muted",
};

const RETURN_STATUSES: ReturnStatus[] = ["pending", "processing", "completed", "restocked"];
const RETURN_REASONS: ReturnReason[] = ["customer_refused", "wrong_address", "not_reachable", "damaged", "wrong_product", "duplicate", "other"];

export default function ReturnsPage() {
  const { t } = useI18n();
  const [returns, setReturns] = useState<Return[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");

  // Create/Edit return modal
  const [showCreate, setShowCreate] = useState(false);
  const [editingReturn, setEditingReturn] = useState<Return | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState({
    order_id: "",
    reason: "",
    notes: "",
  });
  const [storeOrders, setStoreOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Update status modal
  const [showStatus, setShowStatus] = useState(false);
  const [statusReturn, setStatusReturn] = useState<Return | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Delete state
  const [deleteReturn, setDeleteReturn] = useState<Return | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchReturns = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "15");
      if (statusFilter) params.set("status", statusFilter);
      if (reasonFilter) params.set("reason", reasonFilter);

      const res = await apiClient.get(`/returns?${params.toString()}`);
      setReturns(res.data.data);
      setMeta(res.data.meta);
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, reasonFilter]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  // Fetch orders belonging to the current store
  const fetchStoreOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await apiClient.get("/orders?per_page=200");
      setStoreOrders(res.data.data || []);
    } catch {
      setStoreOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Create/Edit handlers
  const openCreateModal = () => {
    setEditingReturn(null);
    setCreateForm({ order_id: "", reason: "", notes: "" });
    setFormErrors({});
    fetchStoreOrders();
    setShowCreate(true);
  };

  const openEditModal = (ret: Return) => {
    setEditingReturn(ret);
    setCreateForm({
      order_id: String(ret.order_id),
      reason: ret.reason || "",
      notes: ret.notes || "",
    });
    setFormErrors({});
    fetchStoreOrders();
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setEditingReturn(null);
    setCreateForm({ order_id: "", reason: "", notes: "" });
    setFormErrors({});
  };

  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setCreateForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreateSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!createForm.order_id || isNaN(Number(createForm.order_id))) errors.order_id = t("returns.error_order_required");
    if (!createForm.reason) errors.reason = t("returns.error_reason_required");
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      order_id: parseInt(createForm.order_id),
      reason: createForm.reason,
      notes: createForm.notes.trim() || undefined,
    };

    setSaving(true);
    try {
      if (editingReturn) {
        await apiClient.put(`/returns/${editingReturn.id}`, payload);
      } else {
        await apiClient.post("/returns", payload);
      }
      closeCreate();
      fetchReturns();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || t(editingReturn ? "returns.error_update" : "returns.error_create");
      setFormErrors({ submit: msg });
    } finally {
      setSaving(false);
    }
  };

  // Status update handlers
  const openStatusUpdate = (ret: Return) => {
    setStatusReturn(ret);
    setNewStatus(ret.status);
    setStatusMsg("");
    setShowStatus(true);
  };

  const handleStatusUpdate = async () => {
    if (!statusReturn || !newStatus) return;
    setUpdatingStatus(true);
    setStatusMsg("");
    try {
      await apiClient.patch(`/returns/${statusReturn.id}/status`, { status: newStatus });
      setStatusMsg(t("returns.success_status"));
      fetchReturns();
      setTimeout(() => setShowStatus(false), 1000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || t("errors.generic");
      setStatusMsg("✗ " + msg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteReturn) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/returns/${deleteReturn.id}`);
      setDeleteReturn(null);
      fetchReturns();
    } catch {
      // handle error
    } finally {
      setIsDeleting(false);
    }
  };

  const statusFilterOptions = RETURN_STATUSES.map((s) => ({
    value: s,
    label: t(`returns.status.${s}`),
  }));

  const reasonFilterOptions = RETURN_REASONS.map((r) => ({
    value: r,
    label: t(`returns.reason.${r}`),
  }));

  const reasonOptions = RETURN_REASONS.map((r) => ({
    value: r,
    label: t(`returns.reason.${r}`),
  }));

  const orderOptions = storeOrders.map((o) => ({
    value: String(o.id),
    label: `${o.reference} — ${o.customer_name} (${o.total_amount} DA)`,
  }));

  const statusUpdateOptions = RETURN_STATUSES.map((s) => ({
    value: s,
    label: t(`returns.status.${s}`),
  }));

  const columns: Column<Return>[] = [
    { key: "order_reference", header: t("returns.order_reference"), render: (r) => r.order_reference || `#${r.order_id}` },
    { key: "customer_name", header: t("returns.customer"), render: (r) => r.customer_name || "—" },
    {
      key: "reason",
      header: t("returns.reason"),
      render: (r) => t(`returns.reason.${r.reason}`),
    },
    {
      key: "status",
      header: t("status"),
      render: (r) => (
        <Badge variant={returnVariant[r.status] || "secondary"}>
          {t(`returns.status.${r.status}`)}
        </Badge>
      ),
    },
    {
      key: "notes",
      header: t("returns.notes"),
      render: (r) => r.notes ? <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{r.notes}</span> : "—",
    },
    {
      key: "created_at",
      header: t("orders.created_at"),
      render: (r) => formatDate(r.created_at),
    },
    {
      key: "actions",
      header: t("actions"),
      className: "w-28",
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openStatusUpdate(r)} title={t("returns.update_status")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openEditModal(r)} title={t("edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteReturn(r)} title={t("delete")}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {t("returns.title")}
        </h1>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          {t("returns.new_return")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={[{ value: "", label: t("filter") + ": " + t("status") }, ...statusFilterOptions]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-48"
        />
        <Select
          options={[{ value: "", label: t("filter") + ": " + t("returns.reason") }, ...reasonFilterOptions]}
          value={reasonFilter}
          onChange={(e) => {
            setReasonFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-52"
        />
      </div>

      <DataTable
        columns={columns}
        data={returns}
        isLoading={isLoading}
        emptyMessage={t("no_results")}
        rowKey={(r) => r.id}
      />

      {meta && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("showing_results", {
              from: (meta.page - 1) * meta.per_page + 1,
              to: Math.min(meta.page * meta.per_page, meta.total),
              total: meta.total,
            })}
          </p>
          <Pagination
            currentPage={meta.page}
            totalPages={meta.total_pages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Create/Edit Return Modal */}
      <Modal
        isOpen={showCreate}
        onClose={closeCreate}
        title={editingReturn ? t("returns.edit_return") : t("returns.new_return")}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label={t("returns.order_id") + " *"}
            name="order_id"
            value={createForm.order_id}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, order_id: e.target.value }))}
            options={orderOptions}
            placeholder={loadingOrders ? t("loading") + "..." : t("returns.select_order")}
            error={formErrors.order_id}
            disabled={!!editingReturn || loadingOrders}
          />
          <Select
            label={t("returns.reason") + " *"}
            name="reason"
            value={createForm.reason}
            onChange={handleCreateChange}
            options={reasonOptions}
            placeholder={t("returns.select_reason")}
            error={formErrors.reason}
          />
          <Textarea
            label={t("returns.notes")}
            name="notes"
            value={createForm.notes}
            onChange={handleCreateChange}
          />

          {formErrors.submit && <p className="text-sm text-destructive">{formErrors.submit}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeCreate}>{t("cancel")}</Button>
            <Button onClick={handleCreateSubmit} isLoading={saving}>
              {editingReturn ? t("returns.update_return") : t("returns.create_return")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Update Status Modal */}
      <Modal isOpen={showStatus} onClose={() => setShowStatus(false)} title={t("returns.update_status")} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {statusReturn?.order_reference || `#${statusReturn?.order_id}`}
            {statusReturn?.customer_name ? ` — ${statusReturn.customer_name}` : ""}
          </p>
          <Select
            label={t("status")}
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            options={statusUpdateOptions}
          />
          {statusMsg && (
            <p className={`text-sm ${statusMsg.startsWith("✗") ? "text-destructive" : "text-green-600"}`}>
              {statusMsg}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowStatus(false)}>{t("cancel")}</Button>
            <Button onClick={handleStatusUpdate} isLoading={updatingStatus}>{t("confirm")}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteReturn}
        onClose={() => setDeleteReturn(null)}
        onConfirm={handleDelete}
        title={t("returns.delete_return")}
        message={t("returns.delete_confirm")}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        isLoading={isDeleting}
      />
    </div>
  );
}
