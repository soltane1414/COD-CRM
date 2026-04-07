"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  fetchStoreInfo,
  fetchStoreProducts,
  placeStorefrontOrder,
  type StoreInfo,
  type StorefrontProduct,
  type PlaceOrderPayload,
} from "@/lib/api/storefront";
import { WILAYAS } from "@/lib/constants/wilayas";
import {
  CheckCircle,
  Store,
  Phone,
  MapPin,
  Send,
  AlertCircle,
  Loader2,
  User,
  Package,
  Hash,
} from "lucide-react";

// ── Slug Detection ────────────────────────────────────────

function detectSlug(): string | null {
  if (typeof window === "undefined") return null;

  // 1. Subdomain: storename.teachpublic.com
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain !== "www") return subdomain;
  }

  // 2. Fallback: ?slug=storename
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

// ── Main Storefront Page ──────────────────────────────────

export default function StorefrontPage() {
  const [slug, setSlug] = useState<string | null>(null);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    product_id: "",
    quantity: "1",
    wilaya_id: "",
    commune: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    reference: string;
    total: number;
  } | null>(null);

  // ── Load Store & Products ───────────────────────────────

  useEffect(() => {
    const s = detectSlug();
    setSlug(s);
    if (!s) {
      setError("لم يتم تحديد المتجر");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [storeData, productsData] = await Promise.all([
          fetchStoreInfo(s!),
          fetchStoreProducts(s!),
        ]);
        setStore(storeData);
        setProducts(productsData);
      } catch {
        setError("المتجر غير موجود أو غير متاح حالياً");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // ── Form Handling ───────────────────────────────────────

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      if (formErrors[name]) {
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }
    },
    [formErrors]
  );

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.customer_name.trim()) errors.customer_name = "الاسم الكامل مطلوب";
    if (!form.customer_phone.trim()) errors.customer_phone = "رقم الهاتف مطلوب";
    else if (!/^(0[567]\d{8})$/.test(form.customer_phone.trim()))
      errors.customer_phone = "رقم هاتف غير صالح (مثال: 0551234567)";
    if (!form.product_id) errors.product_id = "يرجى اختيار منتج";
    if (!form.quantity || parseInt(form.quantity) < 1) errors.quantity = "الكمية مطلوبة";
    if (!form.wilaya_id) errors.wilaya_id = "الولاية مطلوبة";
    if (!form.commune.trim()) errors.commune = "البلدية مطلوبة";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !slug) return;

    setSubmitting(true);
    try {
      const payload: PlaceOrderPayload = {
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        wilaya_id: parseInt(form.wilaya_id, 10),
        commune: form.commune.trim(),
        address: form.commune.trim(),
        items: [
          {
            product_id: parseInt(form.product_id, 10),
            quantity: parseInt(form.quantity, 10),
          },
        ],
      };

      const result = await placeStorefrontOrder(slug, payload);
      setOrderResult({ reference: result.reference, total: result.total_amount });
      setForm({
        customer_name: "",
        customer_phone: "",
        product_id: "",
        quantity: "1",
        wilaya_id: "",
        commune: "",
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "حدث خطأ أثناء إرسال الطلب";
      setFormErrors({ submit: message });
    } finally {
      setSubmitting(false);
    }
  };

  // Selected product info
  const selectedProduct = products.find((p) => String(p.id) === form.product_id);
  const totalPrice = selectedProduct
    ? selectedProduct.price * (parseInt(form.quantity) || 1)
    : 0;

  // ── Loading ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-gray-500">جاري تحميل المتجر...</p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────

  if (error || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">المتجر غير متاح</h1>
          <p className="text-gray-500">{error || "لم نتمكن من العثور على هذا المتجر"}</p>
        </div>
      </div>
    );
  }

  // ── Success ─────────────────────────────────────────────

  if (orderResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">تم إرسال طلبك بنجاح!</h1>
          <p className="text-gray-500 mb-4">
            رقم الطلب: <span className="font-mono font-bold text-blue-600">{orderResult.reference}</span>
          </p>
          <p className="text-gray-500 mb-6">
            المبلغ الإجمالي: <span className="font-bold text-gray-800">{orderResult.total.toLocaleString("fr-DZ")} د.ج</span>
          </p>
          <p className="text-sm text-gray-400 mb-8">سيتم التواصل معك قريباً لتأكيد الطلب</p>
          <button
            onClick={() => setOrderResult(null)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            طلب جديد
          </button>
        </div>
      </div>
    );
  }

  // ── Main Form ───────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {store.logo_url ? (
            <Image
              src={store.logo_url}
              alt={store.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Store className="h-5 w-5 text-blue-600" />
            </div>
          )}
          <h1 className="text-lg font-bold text-gray-800">{store.name}</h1>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Send className="h-5 w-5" />
              طلب منتج
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              املأ النموذج التالي وسنتواصل معك لتأكيد الطلب
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Full Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 text-gray-400" />
                الاسم الكامل *
              </label>
              <input
                type="text"
                name="customer_name"
                value={form.customer_name}
                onChange={handleChange}
                placeholder="مثال: محمد أحمد"
                className={`w-full h-11 rounded-lg border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  formErrors.customer_name ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              />
              {formErrors.customer_name && (
                <p className="text-xs text-red-500 mt-1">{formErrors.customer_name}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Phone className="h-4 w-4 text-gray-400" />
                رقم الهاتف *
              </label>
              <input
                type="tel"
                name="customer_phone"
                value={form.customer_phone}
                onChange={handleChange}
                placeholder="0551234567"
                dir="ltr"
                className={`w-full h-11 rounded-lg border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  formErrors.customer_phone ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              />
              {formErrors.customer_phone && (
                <p className="text-xs text-red-500 mt-1">{formErrors.customer_phone}</p>
              )}
            </div>

            {/* Product */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Package className="h-4 w-4 text-gray-400" />
                المنتج *
              </label>
              <select
                name="product_id"
                value={form.product_id}
                onChange={handleChange}
                className={`w-full h-11 rounded-lg border appearance-none px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  formErrors.product_id ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              >
                <option value="">اختر المنتج</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price.toLocaleString("fr-DZ")} د.ج
                  </option>
                ))}
              </select>
              {formErrors.product_id && (
                <p className="text-xs text-red-500 mt-1">{formErrors.product_id}</p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Hash className="h-4 w-4 text-gray-400" />
                الكمية *
              </label>
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                min="1"
                className={`w-full h-11 rounded-lg border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  formErrors.quantity ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              />
              {formErrors.quantity && (
                <p className="text-xs text-red-500 mt-1">{formErrors.quantity}</p>
              )}
            </div>

            {/* Wilaya */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                الولاية *
              </label>
              <select
                name="wilaya_id"
                value={form.wilaya_id}
                onChange={handleChange}
                className={`w-full h-11 rounded-lg border appearance-none px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  formErrors.wilaya_id ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              >
                <option value="">اختر الولاية</option>
                {WILAYAS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.ar_name}
                  </option>
                ))}
              </select>
              {formErrors.wilaya_id && (
                <p className="text-xs text-red-500 mt-1">{formErrors.wilaya_id}</p>
              )}
            </div>

            {/* Commune */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                البلدية *
              </label>
              <input
                type="text"
                name="commune"
                value={form.commune}
                onChange={handleChange}
                placeholder="اسم البلدية"
                className={`w-full h-11 rounded-lg border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  formErrors.commune ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              />
              {formErrors.commune && (
                <p className="text-xs text-red-500 mt-1">{formErrors.commune}</p>
              )}
            </div>

            {/* Total Preview */}
            {selectedProduct && (
              <div className="bg-blue-50 rounded-lg p-4 flex justify-between items-center">
                <span className="text-sm text-gray-600">المبلغ الإجمالي</span>
                <span className="text-lg font-bold text-blue-600">
                  {totalPrice.toLocaleString("fr-DZ")} د.ج
                </span>
              </div>
            )}

            {/* Submit Error */}
            {formErrors.submit && (
              <div className="px-4 py-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {formErrors.submit}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  إرسال الطلب
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-sm text-gray-400">
          {store.name} © {new Date().getFullYear()} — مدعوم من COD CRM
        </p>
      </footer>
    </div>
  );
}
