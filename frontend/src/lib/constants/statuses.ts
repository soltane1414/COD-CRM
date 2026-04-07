// ============================================================
// COD CRM — Constants: Order Statuses
// ============================================================

import { OrderStatus } from "@/types";

export interface StatusConfig {
  key: OrderStatus;
  label: { en: string; fr: string; ar: string };
  color: string;
  bgColor: string;
}

export const ORDER_STATUSES: Record<OrderStatus, StatusConfig> = {
  new: {
    key: "new",
    label: { en: "New", fr: "Nouveau", ar: "جديد" },
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  confirmed: {
    key: "confirmed",
    label: { en: "Confirmed", fr: "Confirmé", ar: "مؤكد" },
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
  },
  processing: {
    key: "processing",
    label: { en: "Processing", fr: "En traitement", ar: "قيد المعالجة" },
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
  },
  shipped: {
    key: "shipped",
    label: { en: "Shipped", fr: "Expédié", ar: "تم الشحن" },
    color: "text-purple-700",
    bgColor: "bg-purple-100",
  },
  delivered: {
    key: "delivered",
    label: { en: "Delivered", fr: "Livré", ar: "تم التوصيل" },
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  returned: {
    key: "returned",
    label: { en: "Returned", fr: "Retourné", ar: "مُرجع" },
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
  cancelled: {
    key: "cancelled",
    label: { en: "Cancelled", fr: "Annulé", ar: "ملغي" },
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  },
  no_answer: {
    key: "no_answer",
    label: { en: "No Answer", fr: "Pas de réponse", ar: "لا إجابة" },
    color: "text-orange-700",
    bgColor: "bg-orange-100",
  },
  postponed: {
    key: "postponed",
    label: { en: "Postponed", fr: "Reporté", ar: "مؤجل" },
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
};

export const ORDER_STATUS_OPTIONS = Object.values(ORDER_STATUSES);

/**
 * Allowed status transitions for the COD workflow.
 */
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled", "no_answer", "postponed"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  no_answer: ["confirmed", "cancelled", "postponed"],
  postponed: ["new", "cancelled"],
  delivered: ["returned"],
  returned: [],
  cancelled: [],
};
