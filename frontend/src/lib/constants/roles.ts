// ============================================================
// COD CRM — Constants: Roles
// ============================================================

import { UserRole } from "@/types";

export interface RoleConfig {
  key: UserRole;
  label: { en: string; fr: string; ar: string };
  color: string;
  description: { en: string; fr: string; ar: string };
}

export const ROLES: Record<UserRole, RoleConfig> = {
  super_admin: {
    key: "super_admin",
    label: { en: "Super Admin", fr: "Super Administrateur", ar: "المدير العام" },
    color: "indigo",
    description: {
      en: "Platform-level access, manages all stores",
      fr: "Accès plateforme, gère tous les magasins",
      ar: "وصول على مستوى المنصة، يدير جميع المتاجر",
    },
  },
  owner: {
    key: "owner",
    label: { en: "Owner", fr: "Propriétaire", ar: "المالك" },
    color: "purple",
    description: {
      en: "Full access to all features",
      fr: "Accès complet à toutes les fonctionnalités",
      ar: "وصول كامل لجميع الميزات",
    },
  },
  admin: {
    key: "admin",
    label: { en: "Admin", fr: "Administrateur", ar: "مشرف" },
    color: "blue",
    description: {
      en: "Almost full access, cannot delete store",
      fr: "Accès presque complet, ne peut pas supprimer le magasin",
      ar: "وصول شبه كامل، لا يمكنه حذف المتجر",
    },
  },
  order_confirmator: {
    key: "order_confirmator",
    label: { en: "Order Confirmator", fr: "Confirmateur de commandes", ar: "مؤكد الطلبات" },
    color: "green",
    description: {
      en: "Can view and confirm orders",
      fr: "Peut voir et confirmer les commandes",
      ar: "يمكنه عرض وتأكيد الطلبات",
    },
  },
  inventory_manager: {
    key: "inventory_manager",
    label: { en: "Inventory Manager", fr: "Gestionnaire de stock", ar: "مدير المخزون" },
    color: "orange",
    description: {
      en: "Manages products and inventory",
      fr: "Gère les produits et le stock",
      ar: "يدير المنتجات والمخزون",
    },
  },
  accountant: {
    key: "accountant",
    label: { en: "Accountant", fr: "Comptable", ar: "محاسب" },
    color: "yellow",
    description: {
      en: "Read-only access to financial reports",
      fr: "Accès en lecture seule aux rapports financiers",
      ar: "وصول للقراءة فقط للتقارير المالية",
    },
  },
  delivery_manager: {
    key: "delivery_manager",
    label: { en: "Delivery Manager", fr: "Gestionnaire de livraison", ar: "مدير التوصيل" },
    color: "red",
    description: {
      en: "Manages deliveries and returns",
      fr: "Gère les livraisons et les retours",
      ar: "يدير عمليات التوصيل والإرجاع",
    },
  },
};

export const ROLE_OPTIONS = Object.values(ROLES);
