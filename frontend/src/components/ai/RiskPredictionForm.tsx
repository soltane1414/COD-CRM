"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AiCard } from "@/components/ai/AiCard";
import { useI18n } from "@/providers/i18n-provider";
import { WILAYAS } from "@/lib/constants/wilayas";
import type { OrderRiskRequest } from "@/types/ai";

interface RiskPredictionFormProps {
  onSubmit: (data: OrderRiskRequest) => void;
  isLoading: boolean;
}

const DEFAULT_VALUES: OrderRiskRequest = {
  subtotal: 0,
  shipping_cost: 0,
  total_amount: 0,
  n_items: 1,
  is_repeat_customer: false,
  customer_order_count: 0,
  customer_total_spent: 0,
  estimated_delivery_days: 7,
  avg_product_weight: 1.0,
  avg_photos: 1.0,
  avg_desc_length: 500,
  avg_name_length: 30,
  avg_volume: 10000,
  n_sellers: 1,
  n_payment_methods: 1,
  max_installments: 1,
};

const NUMERIC_FIELDS: Set<keyof OrderRiskRequest> = new Set([
  "order_id",
  "wilaya_id",
  "subtotal",
  "shipping_cost",
  "total_amount",
  "n_items",
  "customer_order_count",
  "customer_total_spent",
  "estimated_delivery_days",
  "avg_product_weight",
  "has_boleto",
  "has_credit_card",
  "has_voucher",
  "has_debit_card",
  "n_payment_methods",
  "max_installments",
  "avg_photos",
  "avg_desc_length",
  "avg_name_length",
  "avg_volume",
  "seller_customer_same_state",
  "n_sellers",
]);

const OPTIONAL_FIELDS: Set<keyof OrderRiskRequest> = new Set([
  "order_id",
  "customer_name",
  "customer_phone",
  "wilaya_id",
  "customer_state",
  "commune",
  "product_category",
  "order_date",
  "payment_method",
  "has_boleto",
  "has_credit_card",
  "has_voucher",
  "has_debit_card",
  "seller_customer_same_state",
]);

export function RiskPredictionForm({ onSubmit, isLoading }: RiskPredictionFormProps) {
  const { t, locale } = useI18n();
  const [form, setForm] = useState(DEFAULT_VALUES);
  const [error, setError] = useState<string | null>(null);

  const wilayaOptions = useMemo(
    () => [
      { value: "", label: t("ai.not_provided") },
      ...WILAYAS.map((w) => ({
        value: String(w.id),
        label: `${w.code} - ${locale === "ar" ? w.ar_name : w.name}`,
      })),
    ],
    [locale, t]
  );

  const binaryOptions = [
    { value: "", label: t("ai.not_provided") },
    { value: "1", label: t("yes") },
    { value: "0", label: t("no") },
  ];

  const paymentMethodOptions = [
    { value: "", label: t("ai.not_provided") },
    { value: "cod", label: "COD" },
    { value: "credit_card", label: "Credit Card" },
    { value: "debit_card", label: "Debit Card" },
    { value: "voucher", label: "Voucher" },
    { value: "boleto", label: "Boleto" },
  ];

  const update = (field: keyof OrderRiskRequest, value: string | boolean | number) => {
    setForm((prev) => {
      let parsed: string | number | boolean | undefined = value;

      if (typeof value === "string") {
        if (value === "") {
          parsed = OPTIONAL_FIELDS.has(field)
            ? undefined
            : NUMERIC_FIELDS.has(field)
              ? 0
              : "";
        } else if (NUMERIC_FIELDS.has(field)) {
          const numericValue = Number(value);
          parsed = Number.isFinite(numericValue) ? numericValue : 0;
        }
      }

      const updated = {
        ...prev,
        [field]: parsed,
      };

      // Auto-calculate total_amount when subtotal or shipping_cost changes
      if (field === "subtotal" || field === "shipping_cost") {
        updated.total_amount = (Number(updated.subtotal) || 0) + (Number(updated.shipping_cost) || 0);
      }

      return updated;
    });
  };

  const validate = (): string | null => {
    if ((form.subtotal ?? 0) < 0 || (form.shipping_cost ?? 0) < 0) {
      return t("ai.validation_non_negative");
    }
    if ((form.n_items ?? 0) < 1 || (form.n_sellers ?? 0) < 1) {
      return t("ai.validation_min_one");
    }
    if ((form.estimated_delivery_days ?? 0) < 1) {
      return t("ai.validation_delivery_days");
    }
    if ((form.max_installments ?? 1) < 1 || (form.n_payment_methods ?? 1) < 1) {
      return t("ai.validation_payment_values");
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== undefined && value !== "")
    ) as OrderRiskRequest;
    onSubmit(payload);
  };

  return (
    <AiCard title={t("ai.order_details")}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label={t("ai.order_id")} type="number" min={1} value={form.order_id ?? ""} onChange={(e) => update("order_id", e.target.value)} />
          <Input label={t("ai.order_date")} type="datetime-local" value={form.order_date ?? ""} onChange={(e) => update("order_date", e.target.value)} />
          <Input label={t("ai.subtotal")} type="number" value={form.subtotal} onChange={(e) => update("subtotal", e.target.value)} />
          <Input label={t("ai.shipping_cost")} type="number" value={form.shipping_cost} onChange={(e) => update("shipping_cost", e.target.value)} />
          <Input label={`${t("ai.total_amount")} (DZD)`} type="number" value={form.total_amount} disabled className="bg-muted" />
          <Input label={t("ai.n_items")} type="number" min={1} value={form.n_items} onChange={(e) => update("n_items", e.target.value)} />
          <Input label={t("ai.product_category")} value={form.product_category ?? ""} onChange={(e) => update("product_category", e.target.value)} />
          <Select label={t("ai.wilaya_id")} value={form.wilaya_id !== undefined ? String(form.wilaya_id) : ""} options={wilayaOptions} onChange={(e) => update("wilaya_id", e.target.value)} />
          <Input label={t("ai.customer_state")} value={form.customer_state ?? ""} onChange={(e) => update("customer_state", e.target.value)} />
          <Input label={t("ai.commune")} value={form.commune ?? ""} onChange={(e) => update("commune", e.target.value)} />
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{t("ai.customer_info")}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label={t("ai.customer_name")} value={form.customer_name ?? ""} onChange={(e) => update("customer_name", e.target.value)} />
            <Input label={t("ai.customer_phone")} value={form.customer_phone ?? ""} onChange={(e) => update("customer_phone", e.target.value)} />
            <Input label={t("ai.customer_order_count")} type="number" min={0} value={form.customer_order_count} onChange={(e) => update("customer_order_count", e.target.value)} />
            <Input label={`${t("ai.customer_total_spent")} (DZD)`} type="number" min={0} value={form.customer_total_spent} onChange={(e) => update("customer_total_spent", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm text-foreground">
            <input type="checkbox" checked={form.is_repeat_customer} onChange={(e) => update("is_repeat_customer", e.target.checked)} className="rounded border-input" />
            {t("ai.is_repeat_customer")}
          </label>
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{t("ai.logistics")}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label={t("ai.estimated_delivery_days")} type="number" min={1} value={form.estimated_delivery_days} onChange={(e) => update("estimated_delivery_days", e.target.value)} />
            <Input label={t("ai.avg_product_weight")} type="number" min={0} step={0.1} value={form.avg_product_weight} onChange={(e) => update("avg_product_weight", e.target.value)} />
            <Input label={t("ai.n_sellers")} type="number" min={1} value={form.n_sellers} onChange={(e) => update("n_sellers", e.target.value)} />
            <Select
              label={t("ai.seller_customer_same_state")}
              value={form.seller_customer_same_state !== undefined ? String(form.seller_customer_same_state) : ""}
              options={binaryOptions}
              onChange={(e) => update("seller_customer_same_state", e.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{t("ai.product_quality")}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label={t("ai.avg_photos")} type="number" min={0} step={1} value={form.avg_photos} onChange={(e) => update("avg_photos", e.target.value)} />
            <Input label={t("ai.avg_desc_length")} type="number" min={0} value={form.avg_desc_length} onChange={(e) => update("avg_desc_length", e.target.value)} />
            <Input label={t("ai.avg_name_length")} type="number" min={0} value={form.avg_name_length} onChange={(e) => update("avg_name_length", e.target.value)} />
            <Input label={t("ai.avg_volume")} type="number" min={0} value={form.avg_volume} onChange={(e) => update("avg_volume", e.target.value)} />
          </div>
        </div>

        <details className="border-t border-border pt-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground mb-3">{t("ai.payment_advanced")}</summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <Select
              label={t("ai.payment_method")}
              value={form.payment_method ?? ""}
              options={paymentMethodOptions}
              onChange={(e) => update("payment_method", e.target.value)}
            />
            <Input label={t("ai.n_payment_methods")} type="number" min={1} value={form.n_payment_methods ?? 1} onChange={(e) => update("n_payment_methods", e.target.value)} />
            <Input label={t("ai.max_installments")} type="number" min={1} value={form.max_installments ?? 1} onChange={(e) => update("max_installments", e.target.value)} />
            <Select label={t("ai.has_boleto")} value={form.has_boleto !== undefined ? String(form.has_boleto) : ""} options={binaryOptions} onChange={(e) => update("has_boleto", e.target.value)} />
            <Select label={t("ai.has_credit_card")} value={form.has_credit_card !== undefined ? String(form.has_credit_card) : ""} options={binaryOptions} onChange={(e) => update("has_credit_card", e.target.value)} />
            <Select label={t("ai.has_voucher")} value={form.has_voucher !== undefined ? String(form.has_voucher) : ""} options={binaryOptions} onChange={(e) => update("has_voucher", e.target.value)} />
            <Select label={t("ai.has_debit_card")} value={form.has_debit_card !== undefined ? String(form.has_debit_card) : ""} options={binaryOptions} onChange={(e) => update("has_debit_card", e.target.value)} />
          </div>
        </details>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
          {t("ai.predict_risk")}
        </Button>
      </form>
    </AiCard>
  );
}
