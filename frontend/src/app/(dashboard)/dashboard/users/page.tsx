"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/providers/i18n-provider";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api/client";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { ROLES } from "@/lib/constants/roles";
import type { User, UserRole } from "@/types/auth";
import type { PaginationMeta } from "@/types";

export default function UsersPage() {
  const { t, locale } = useI18n();
  const { hasRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create/Edit user modal
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "",
  });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "15");
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);

      const res = await apiClient.get(`/users?${params.toString()}`);
      setUsers(res.data.data);
      setMeta(res.data.meta);
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async () => {
    if (!deleteUser) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/users/${deleteUser.id}`);
      setDeleteUser(null);
      fetchUsers();
    } catch {
      // handle error
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setUserForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setUserForm({ name: "", email: "", password: "", phone: "", role: "" });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setUserForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      phone: user.phone || "",
      role: user.role || "",
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setUserForm({ name: "", email: "", password: "", phone: "", role: "" });
    setFormErrors({});
  };

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!userForm.name.trim()) errors.name = t("users.error_name_required");
    if (!editingUser) {
      if (!userForm.email.trim()) errors.email = t("users.error_email_required");
      if (!userForm.password || userForm.password.length < 8) errors.password = t("users.error_password_required");
    }
    if (!userForm.role) errors.role = t("users.error_role_required");
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const payload: Record<string, string> = {
          name: userForm.name.trim(),
          role: userForm.role,
        };
        if (userForm.phone.trim()) payload.phone = userForm.phone.trim();
        if (userForm.password) payload.password = userForm.password;
        await apiClient.put(`/users/${editingUser.id}`, payload);
      } else {
        await apiClient.post("/users", {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          password: userForm.password,
          phone: userForm.phone.trim() || undefined,
          role: userForm.role,
        });
      }
      closeModal();
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || t(editingUser ? "users.error_update" : "users.error_create");
      setFormErrors({ submit: msg });
    } finally {
      setSaving(false);
    }
  };

  const createRoleOptions = [
    { value: "admin", label: ROLES.admin.label[locale as "en" | "fr" | "ar"] || "Admin" },
    { value: "order_confirmator", label: ROLES.order_confirmator.label[locale as "en" | "fr" | "ar"] || "Order Confirmator" },
    { value: "inventory_manager", label: ROLES.inventory_manager.label[locale as "en" | "fr" | "ar"] || "Inventory Manager" },
    { value: "accountant", label: ROLES.accountant.label[locale as "en" | "fr" | "ar"] || "Accountant" },
    { value: "delivery_manager", label: ROLES.delivery_manager.label[locale as "en" | "fr" | "ar"] || "Delivery Manager" },
  ];

  const roleOptions = Object.entries(ROLES).map(([key, val]) => ({
    value: key,
    label: val.label[locale as "en" | "fr" | "ar"] || val.label.en,
  }));

  const columns: Column<User>[] = [
    { key: "name", header: t("users.name") },
    { key: "email", header: t("users.email") },
    {
      key: "role",
      header: t("users.role"),
      render: (u) => {
        const role = ROLES[u.role as UserRole];
        return (
          <Badge
            variant="secondary"
            className={role?.color ? `bg-${role.color}-100 text-${role.color}-800` : ""}
          >
            {role?.label[locale as "en" | "fr" | "ar"] || u.role}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: t("users.status"),
      render: (u) => (
        <Badge variant={u.status === "active" ? "success" : "muted"}>
          {t(`users.status.${u.status}`)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      className: "w-24",
      render: (u) =>
        u.role !== "owner" && hasRole("admin") ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(u);
              }}
              title={t("edit")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteUser(u);
              }}
              title={t("delete")}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {t("users.title")}
        </h1>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          {t("users.new_user")}
        </Button>
      </div>

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
          options={[{ value: "", label: t("filter") + ": " + t("users.role") }, ...roleOptions]}
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-56"
        />
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage={t("no_results")}
        rowKey={(u) => u.id}
      />

      {meta && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          onPageChange={setPage}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        title={t("delete") + " " + (deleteUser?.name || "")}
        message={t("users.delete_confirm")}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        isLoading={isDeleting}
      />

      {/* Create/Edit User Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingUser ? t("users.edit_user") : t("users.new_user")}
        size="lg"
      >
        <div className="space-y-4">
          <Input label={t("auth.name") + " *"} name="name" value={userForm.name} onChange={handleFormChange} error={formErrors.name} />
          {!editingUser && (
            <Input label={t("auth.email") + " *"} name="email" type="email" value={userForm.email} onChange={handleFormChange} error={formErrors.email} />
          )}
          {editingUser && (
            <Input label={t("auth.email")} value={editingUser.email} disabled hint={t("settings.email_hint")} />
          )}
          <Input
            label={editingUser ? t("auth.password") + " (" + t("settings.theme.light").toLowerCase() + ")" : t("auth.password") + " *"}
            name="password"
            type="password"
            value={userForm.password}
            onChange={handleFormChange}
            error={formErrors.password}
            hint={editingUser ? undefined : undefined}
          />
          <Input label={t("users.phone")} name="phone" value={userForm.phone} onChange={handleFormChange} />
          <Select label={t("users.role") + " *"} name="role" value={userForm.role} onChange={handleFormChange} options={createRoleOptions} placeholder={t("users.select_role")} error={formErrors.role} />

          {formErrors.submit && <p className="text-sm text-destructive">{formErrors.submit}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeModal}>{t("cancel")}</Button>
            <Button onClick={handleSubmit} isLoading={saving}>
              {editingUser ? t("users.update_user") : t("users.create_user")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
