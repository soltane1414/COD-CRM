"use client";

import Link from "next/link";
import {
  ShoppingCart,
  BarChart3,
  Users,
  Truck,
  Shield,
  Globe,
  ArrowRight,
  CheckCircle2,
  Store,
  Zap,
  Package,
  Brain,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

const features = [
  {
    icon: <ShoppingCart className="h-6 w-6" />,
    title: { fr: "Gestion des commandes", en: "Order Management", ar: "إدارة الطلبات" },
    desc: {
      fr: "Suivez vos commandes COD du début à la livraison",
      en: "Track your COD orders from start to delivery",
      ar: "تتبع طلبات الدفع عند التسليم من البداية للنهاية",
    },
  },
  {
    icon: <Truck className="h-6 w-6" />,
    title: { fr: "Suivi des livraisons", en: "Delivery Tracking", ar: "تتبع التوصيل" },
    desc: {
      fr: "Gérez vos livraisons à travers les 69 wilayas",
      en: "Manage deliveries across all 69 wilayas",
      ar: "إدارة التوصيل عبر الـ 69 ولاية",
    },
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: { fr: "Analytique avancée", en: "Advanced Analytics", ar: "تحليلات متقدمة" },
    desc: {
      fr: "Tableaux de bord et rapports en temps réel",
      en: "Real-time dashboards and reports",
      ar: "لوحات تحكم وتقارير في الوقت الفعلي",
    },
  },
  {
    icon: <Package className="h-6 w-6" />,
    title: { fr: "Gestion des stocks", en: "Inventory Management", ar: "إدارة المخزون" },
    desc: {
      fr: "Contrôlez votre inventaire avec alertes de stock bas",
      en: "Control inventory with low-stock alerts",
      ar: "تحكم في المخزون مع تنبيهات نقص المخزون",
    },
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: { fr: "Gestion d'équipe", en: "Team Management", ar: "إدارة الفريق" },
    desc: {
      fr: "Rôles et permissions pour votre équipe",
      en: "Roles and permissions for your team",
      ar: "أدوار وصلاحيات لفريق العمل",
    },
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: { fr: "Multi-tenant sécurisé", en: "Secure Multi-tenant", ar: "متعدد المتاجر وآمن" },
    desc: {
      fr: "Chaque boutique a ses données isolées et sécurisées",
      en: "Each store has isolated and secured data",
      ar: "كل متجر بياناته معزولة وآمنة",
    },
  },
  {
    icon: <AlertCircle className="h-6 w-6" />,
    title: { fr: "Prédiction de risque IA", en: "AI Risk Prediction", ar: "التنبؤ بالمخاطر بالذكاء الاصطناعي" },
    desc: {
      fr: "Détectez les commandes à risque avant expédition (fraude, non-livraison)",
      en: "Detect risky orders before shipping (fraud, non-delivery)",
      ar: "اكتشف الطلبات المحفوفة بالمخاطر قبل الشحن",
    },
  },
  {
    icon: <TrendingUp className="h-6 w-6" />,
    title: { fr: "Prévision de la demande", en: "Demand Forecasting", ar: "التنبؤ بالطلب" },
    desc: {
      fr: "Prédisez les ventes futures par catégorie avec ML",
      en: "Predict future sales by category with machine learning",
      ar: "توقع المبيعات المستقبلية حسب الفئة",
    },
  },
  {
    icon: <Brain className="h-6 w-6" />,
    title: { fr: "Segmentation IA", en: "AI Segmentation", ar: "التقسيم بالذكاء الاصطناعي" },
    desc: {
      fr: "Identifiez automatiquement vos segments de clients",
      en: "Automatically identify customer segments",
      ar: "حدد قطاعات العملاء تلقائياً",
    },
  },
];

const stats = [
  { value: "69", label: { fr: "Wilayas couvertes", en: "Wilayas covered", ar: "ولاية مغطاة" } },
  { value: "24/7", label: { fr: "Disponible", en: "Available", ar: "متوفر" } },
  { value: "100%", label: { fr: "COD optimisé", en: "COD optimized", ar: "محسّن للدفع عند التسليم" } },
  { value: "∞", label: { fr: "Commandes illimitées", en: "Unlimited orders", ar: "طلبات غير محدودة" } },
];

const plans = [
  {
    name: { fr: "Starter", en: "Starter", ar: "المبتدئ" },
    price: "0 DA",
    period: { fr: "/mois", en: "/month", ar: "/شهر" },
    features: [
      { fr: "1 boutique", en: "1 store", ar: "متجر واحد" },
      { fr: "100 commandes/mois", en: "100 orders/month", ar: "100 طلب/شهر" },
      { fr: "2 utilisateurs", en: "2 users", ar: "مستخدمين 2" },
      { fr: "Analytique de base", en: "Basic analytics", ar: "تحليلات أساسية" },
    ],
    cta: { fr: "Commencer gratuitement", en: "Start free", ar: "ابدأ مجاناً" },
    highlighted: false,
  },
  {
    name: { fr: "Pro", en: "Pro", ar: "الاحترافي" },
    price: "4,900 DA",
    period: { fr: "/mois", en: "/month", ar: "/شهر" },
    features: [
      { fr: "1 boutique", en: "1 store", ar: "متجر واحد" },
      { fr: "Commandes illimitées", en: "Unlimited orders", ar: "طلبات غير محدودة" },
      { fr: "10 utilisateurs", en: "10 users", ar: "10 مستخدمين" },
      { fr: "Analytique avancée", en: "Advanced analytics", ar: "تحليلات متقدمة" },
      { fr: "Support prioritaire", en: "Priority support", ar: "دعم أولوي" },
    ],
    cta: { fr: "Essai gratuit 14 jours", en: "14-day free trial", ar: "تجربة مجانية 14 يوم" },
    highlighted: true,
  },
  {
    name: { fr: "Enterprise", en: "Enterprise", ar: "المؤسسات" },
    price: { fr: "Sur mesure", en: "Custom", ar: "حسب الطلب" },
    period: { fr: "", en: "", ar: "" },
    features: [
      { fr: "Multi-boutiques", en: "Multi-store", ar: "متعدد المتاجر" },
      { fr: "Commandes illimitées", en: "Unlimited orders", ar: "طلبات غير محدودة" },
      { fr: "Utilisateurs illimités", en: "Unlimited users", ar: "مستخدمين غير محدودين" },
      { fr: "API dédiée", en: "Dedicated API", ar: "API مخصص" },
      { fr: "Manager dédié", en: "Dedicated manager", ar: "مدير مخصص" },
    ],
    cta: { fr: "Contactez-nous", en: "Contact us", ar: "اتصل بنا" },
    highlighted: false,
  },
];

export default function LandingPage() {
  const lang = "fr";
  const t = (obj: Record<string, string>) => obj[lang] || obj.en;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* ── Navigation ─────────────────────────────────── */}
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
              <Store className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">COD CRM</span>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors">
              {t({ fr: "Fonctionnalités", en: "Features", ar: "المميزات" })}
            </a>
            <a href="#pricing" className="text-sm text-slate-300 hover:text-white transition-colors">
              {t({ fr: "Tarifs", en: "Pricing", ar: "الأسعار" })}
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              {t({ fr: "Connexion", en: "Login", ar: "تسجيل الدخول" })}
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              {t({ fr: "Créer un compte", en: "Sign up", ar: "إنشاء حساب" })}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-[400px] w-[400px] rounded-full bg-purple-600/15 blur-[100px]" />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-300">
            <Zap className="h-4 w-4" />
            {t({ fr: "Plateforme #1 pour le e-commerce COD en Algérie", en: "#1 platform for COD e-commerce in Algeria", ar: "المنصة رقم 1 للتجارة الإلكترونية COD في الجزائر" })}
          </div>

          <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {t({ fr: "Gérez votre", en: "Manage your", ar: "أدِر" })}{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {t({ fr: "e-commerce COD", en: "COD e-commerce", ar: "تجارتك الإلكترونية" })}
            </span>
            <br />
            {t({ fr: "comme un pro", en: "like a pro", ar: "كالمحترفين" })}
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-400">
            {t({
              fr: "COD CRM est la plateforme tout-en-un pour gérer vos commandes, livraisons, stocks et équipe. Conçu spécialement pour le marché algérien.",
              en: "COD CRM is the all-in-one platform to manage your orders, deliveries, inventory and team. Built specifically for the Algerian market.",
              ar: "COD CRM هي المنصة الشاملة لإدارة طلباتك، التوصيل، المخزون والفريق. مصممة خصيصاً للسوق الجزائري.",
            })}
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 transition-all hover:shadow-indigo-600/40"
            >
              {t({ fr: "Démarrer gratuitement", en: "Start for free", ar: "ابدأ مجاناً" })}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-all"
            >
              {t({ fr: "Découvrir", en: "Discover", ar: "اكتشف" })}
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────── */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-bold text-indigo-400">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-400">{t(stat.label)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">
              {t({ fr: "Tout ce dont vous avez besoin", en: "Everything you need", ar: "كل ما تحتاجه" })}
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              {t({
                fr: "Des outils puissants pour gérer votre activité e-commerce COD",
                en: "Powerful tools to manage your COD e-commerce business",
                ar: "أدوات قوية لإدارة نشاطك التجاري COD",
              })}
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all hover:border-indigo-500/30 hover:bg-white/[0.04]"
              >
                <div className="mb-4 inline-flex rounded-xl bg-indigo-600/10 p-3 text-indigo-400 group-hover:bg-indigo-600/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{t(feature.title)}</h3>
                <p className="text-sm text-slate-400">{t(feature.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────── */}
      <section className="border-y border-white/10 bg-white/[0.02] py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-16 text-center text-3xl font-bold sm:text-4xl">
            {t({ fr: "Comment ça marche ?", en: "How it works?", ar: "كيف يعمل؟" })}
          </h2>

          <div className="grid gap-12 md:grid-cols-3">
            {[
              {
                step: "01",
                title: { fr: "Créez votre boutique", en: "Create your store", ar: "أنشئ متجرك" },
                desc: { fr: "Inscrivez-vous et configurez votre boutique en quelques minutes", en: "Sign up and configure your store in minutes", ar: "سجّل وأعدّ متجرك في دقائق" },
              },
              {
                step: "02",
                title: { fr: "Ajoutez vos produits", en: "Add your products", ar: "أضف منتجاتك" },
                desc: { fr: "Importez ou ajoutez vos produits avec gestion de stock automatique", en: "Import or add products with automatic stock management", ar: "استورد أو أضف منتجاتك مع إدارة المخزون التلقائية" },
              },
              {
                step: "03",
                title: { fr: "Gérez & livrez", en: "Manage & deliver", ar: "أدِر ووصّل" },
                desc: { fr: "Traitez les commandes, suivez les livraisons et analysez les performances", en: "Process orders, track deliveries, and analyze performance", ar: "عالج الطلبات، تابع التوصيل، وحلل الأداء" },
              },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{t(item.title)}</h3>
                <p className="text-sm text-slate-400">{t(item.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────── */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-center text-3xl font-bold sm:text-4xl">
            {t({ fr: "Tarifs simples et transparents", en: "Simple & transparent pricing", ar: "أسعار بسيطة وشفافة" })}
          </h2>
          <p className="mb-16 text-center text-lg text-slate-400">
            {t({ fr: "Commencez gratuitement, évoluez selon vos besoins", en: "Start free, scale as you grow", ar: "ابدأ مجاناً وتطوّر حسب احتياجاتك" })}
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl border p-8 ${
                  plan.highlighted
                    ? "border-indigo-500 bg-indigo-600/5 shadow-xl shadow-indigo-600/10"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold">
                    {t({ fr: "Le plus populaire", en: "Most popular", ar: "الأكثر شعبية" })}
                  </div>
                )}
                <h3 className="mb-2 text-xl font-bold">{t(plan.name)}</h3>
                <div className="mb-6">
                  <span className="text-3xl font-extrabold">
                    {typeof plan.price === "string" ? plan.price : t(plan.price)}
                  </span>
                  <span className="text-slate-400">{t(plan.period)}</span>
                </div>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                      {t(f)}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? "bg-indigo-600 text-white hover:bg-indigo-500"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {t(plan.cta)}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section className="border-t border-white/10 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <Globe className="mx-auto mb-6 h-12 w-12 text-indigo-400" />
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            {t({ fr: "Prêt à développer votre business ?", en: "Ready to grow your business?", ar: "مستعد لتطوير تجارتك؟" })}
          </h2>
          <p className="mb-8 text-lg text-slate-400">
            {t({
              fr: "Rejoignez les commerçants algériens qui utilisent COD CRM pour gérer leur activité",
              en: "Join Algerian merchants using COD CRM to manage their business",
              ar: "انضم للتجار الجزائريين الذين يستخدمون COD CRM لإدارة نشاطهم",
            })}
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 transition-all"
          >
            {t({ fr: "Créer mon compte gratuitement", en: "Create my free account", ar: "أنشئ حسابي مجاناً" })}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-indigo-400" />
            <span className="font-semibold">COD CRM</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">
              {t({ fr: "Fonctionnalités", en: "Features", ar: "المميزات" })}
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              {t({ fr: "Tarifs", en: "Pricing", ar: "الأسعار" })}
            </a>
            <Link href="/login" className="hover:text-white transition-colors">
              {t({ fr: "Connexion", en: "Login", ar: "دخول" })}
            </Link>
          </div>
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} COD CRM. {t({ fr: "Tous droits réservés", en: "All rights reserved", ar: "جميع الحقوق محفوظة" })}.
          </p>
        </div>
      </footer>
    </div>
  );
}
