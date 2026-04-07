"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/providers/i18n-provider";
import apiClient from "@/lib/api/client";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Search, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Delivery, DeliveryStatus } from "@/types/delivery";
import type { Order } from "@/types/order";
import type { PaginationMeta } from "@/types";

const deliveryVariant: Record<string, "default" | "warning" | "success" | "destructive" | "muted"> = {
  pending: "muted",
  picked_up: "default",
  in_transit: "warning",
  delivered: "success",
  returned: "destructive",
  failed: "destructive",
};

const DELIVERY_STATUSES: DeliveryStatus[] = ["pending", "picked_up", "in_transit", "delivered", "returned", "failed"];

export default function DeliveriesPage() {
  const { t } = useI18n();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Create/Edit delivery modal
  const [showCreate, setShowCreate] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState({
    order_id: "",
    delivery_partner: "",
    tracking_number: "",
    notes: "",
  });
  const [storeOrders, setStoreOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Update status modal
  const [showStatus, setShowStatus] = useState(false);
  const [statusDelivery, setStatusDelivery] = useState<Delivery | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Delete state
  const [deleteDelivery, setDeleteDelivery] = useState<Delivery | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDeliveries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "15");
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("partner", search);

      const res = await apiClient.get(`/deliveries?${params.toString()}`);
      setDeliveries(res.data.data);
      setMeta(res.data.meta);
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

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
    setEditingDelivery(null);
    setCreateForm({ order_id: "", delivery_partner: "", tracking_number: "", notes: "" });
    setFormErrors({});
    fetchStoreOrders();
    setShowCreate(true);
  };

  const openEditModal = (delivery: Delivery) => {
    setEditingDelivery(delivery);
    setCreateForm({
      order_id: String(delivery.order_id),
      delivery_partner: delivery.delivery_partner || "",
      tracking_number: delivery.tracking_number || "",
      notes: delivery.notes || "",
    });
    setFormErrors({});
    fetchStoreOrders();
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setEditingDelivery(null);
    setCreateForm({ order_id: "", delivery_partner: "", tracking_number: "", notes: "" });
    setFormErrors({});
  };

  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCreateForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreateSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!createForm.order_id || isNaN(Number(createForm.order_id))) errors.order_id = t("deliveries.error_order_required");
    if (!createForm.delivery_partner.trim()) errors.delivery_partner = t("deliveries.error_partner_required");
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      order_id: parseInt(createForm.order_id),
      delivery_partner: createForm.delivery_partner.trim(),
      tracking_number: createForm.tracking_number.trim() || undefined,
      notes: createForm.notes.trim() || undefined,
    };

    setSaving(true);
    try {
      if (editingDelivery) {
        await apiClient.put(`/deliveries/${editingDelivery.id}`, payload);
      } else {
        await apiClient.post("/deliveries", payload);
      }
      closeCreate();
      fetchDeliveries();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || t(editingDelivery ? "deliveries.error_update" : "deliveries.error_create");
      setFormErrors({ submit: msg });
    } finally {
      setSaving(false);
    }
  };

  // Status update handlers
  const openStatusUpdate = (delivery: Delivery) => {
    setStatusDelivery(delivery);
    setNewStatus(delivery.status);
    setStatusMsg("");
    setShowStatus(true);
  };

  const handleStatusUpdate = async () => {
    if (!statusDelivery || !newStatus) return;
    setUpdatingStatus(true);
    setStatusMsg("");
    try {
      await apiClient.patch(`/deliveries/${statusDelivery.id}/status`, { status: newStatus });
      setStatusMsg(t("deliveries.success_status"));
      fetchDeliveries();
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
    if (!deleteDelivery) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/deliveries/${deleteDelivery.id}`);
      setDeleteDelivery(null);
      fetchDeliveries();
    } catch {
      // handle error
    } finally {
      setIsDeleting(false);
    }
  };

  const orderOptions = storeOrders.map((o) => ({
    value: String(o.id),
    label: `${o.reference} — ${o.customer_name} (${o.total_amount} DA)`,
  }));

  const statusFilterOptions = DELIVERY_STATUSES.map((s) => ({
    value: s,
    label: t(`deliveries.status.${s}`),
  }));

  const statusUpdateOptions = DELIVERY_STATUSES.map((s) => ({
    value: s,
    label: t(`deliveries.status.${s}`),
  }));

  const columns: Column<Delivery>[] = [
    { key: "order_reference", header: t("deliveries.order_reference"), render: (d) => d.order_reference || `#${d.order_id}` },
    { key: "customer_name", header: t("deliveries.customer"), render: (d) => d.customer_name || "—" },
    { key: "delivery_partner", header: t("deliveries.delivery_company") },
    { key: "tracking_number", header: t("deliveries.tracking_number"), render: (d) => d.tracking_number || "—" },
    {
      key: "status",
      header: t("status"),
      render: (d) => (
        <Badge variant={deliveryVariant[d.status] || "secondary"}>
          {t(`deliveries.status.${d.status}`)}
        </Badge>
      ),
    },
    {
      key: "picked_up_at",
      header: t("deliveries.picked_up_at"),
      render: (d) => d.picked_up_at ? formatDate(d.picked_up_at) : "—",
    },
    {
      key: "delivered_at",
      header: t("deliveries.delivered_at"),
      render: (d) => d.delivered_at ? formatDate(d.delivered_at) : "—",
    },
    {
      key: "actions",
      header: t("actions"),
      className: "w-28",
      render: (d) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openStatusUpdate(d)} title={t("deliveries.update_status")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openEditModal(d)} title={t("edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteDelivery(d)} title={t("delete")}>
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
          {t("deliveries.title")}
        </h1>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          {t("deliveries.new_delivery")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
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
        <Select
          options={[{ value: "", label: t("filter") + ": " + t("status") }, ...statusFilterOptions]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-48"
        />
      </div>

      <DataTable
        columns={columns}
        data={deliveries}
        isLoading={isLoading}
        emptyMessage={t("no_results")}
        rowKey={(d) => d.id}
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

      {/* Create/Edit Delivery Modal */}
      <Modal
        isOpen={showCreate}
        onClose={closeCreate}
        title={editingDelivery ? t("deliveries.edit_delivery") : t("deliveries.new_delivery")}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label={t("deliveries.order_id") + " *"}
            name="order_id"
            value={createForm.order_id}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, order_id: e.target.value }))}
            options={orderOptions}
            placeholder={loadingOrders ? t("loading") + "..." : t("deliveries.select_order")}
            error={formErrors.order_id}
            disabled={!!editingDelivery || loadingOrders}
          />
          <Input
            label={t("deliveries.delivery_company") + " *"}
            name="delivery_partner"
            value={createForm.delivery_partner}
            onChange={handleCreateChange}
            error={formErrors.delivery_partner}
          />
          <Input
            label={t("deliveries.tracking_number")}
            name="tracking_number"
            value={createForm.tracking_number}
            onChange={handleCreateChange}
          />
          <Textarea
            label={t("deliveries.notes")}
            name="notes"
            value={createForm.notes}
            onChange={handleCreateChange}
          />

          {formErrors.submit && <p className="text-sm text-destructive">{formErrors.submit}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeCreate}>{t("cancel")}</Button>
            <Button onClick={handleCreateSubmit} isLoading={saving}>
              {editingDelivery ? t("deliveries.update_delivery") : t("deliveries.create_delivery")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Update Status Modal */}
      <Modal isOpen={showStatus} onClose={() => setShowStatus(false)} title={t("deliveries.update_status")} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {statusDelivery?.order_reference || `#${statusDelivery?.order_id}`} — {statusDelivery?.delivery_partner}
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
        isOpen={!!deleteDelivery}
        onClose={() => setDeleteDelivery(null)}
        onConfirm={handleDelete}
        title={t("deliveries.delete_delivery")}
        message={t("deliveries.delete_confirm")}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        isLoading={isDeleting}
      />
    </div>
  );
}
