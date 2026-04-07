"use client";

import { useState } from "react";
import { useI18n } from "@/providers/i18n-provider";
import { useAuth } from "@/hooks/use-auth";
import { useUIStore } from "@/stores/ui-store";
import apiClient from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SUPPORTED_LOCALES } from "@/lib/constants";

export default function SettingsPage() {
  const { t } = useI18n();
  const { user, store } = useAuth();
  const { theme, setTheme, locale, setLocale } = useUIStore();

  const [storeName, setStoreName] = useState(store?.name || "");
  const [userName, setUserName] = useState(user?.name || "");
  const [userEmail] = useState(user?.email || "");

  const [savingStore, setSavingStore] = useState(false);
  const [storeMsg, setStoreMsg] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const handleSaveStore = async () => {
    if (!storeName.trim()) return;
    setSavingStore(true);
    setStoreMsg("");
    try {
      await apiClient.put("/store", { name: storeName.trim() });
      setStoreMsg("✓ " + t("settings.save_store_success"));
    } catch {
      setStoreMsg("✗ " + t("settings.save_store_error"));
    } finally {
      setSavingStore(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userName.trim()) return;
    setSavingProfile(true);
    setProfileMsg("");
    try {
      await apiClient.put(`/users/${user?.id}`, { name: userName.trim() });
      setProfileMsg("✓ " + t("settings.save_profile_success"));
    } catch {
      setProfileMsg("✗ " + t("settings.save_profile_error"));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">
        {t("settings.title")}
      </h1>

      {/* Store Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.store_info")}</CardTitle>
          <CardDescription>{t("settings.store_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={t("auth.store_name")}
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
          />
          {storeMsg && <p className={`text-sm ${storeMsg.startsWith("✓") ? "text-green-600" : "text-destructive"}`}>{storeMsg}</p>}
          <Button onClick={handleSaveStore} isLoading={savingStore}>{t("save")}</Button>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile")}</CardTitle>
          <CardDescription>{t("settings.profile_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={t("auth.name")}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <Input
            label={t("auth.email")}
            value={userEmail}
            disabled
            hint={t("settings.email_hint")}
          />
          {profileMsg && <p className={`text-sm ${profileMsg.startsWith("✓") ? "text-green-600" : "text-destructive"}`}>{profileMsg}</p>}
          <Button onClick={handleSaveProfile} isLoading={savingProfile}>{t("save")}</Button>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance")}</CardTitle>
          <CardDescription>{t("settings.appearance_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label={t("settings.theme")}
            value={theme}
            onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
            options={[
              { value: "light", label: t("settings.theme.light") },
              { value: "dark", label: t("settings.theme.dark") },
              { value: "system", label: t("settings.theme.system") },
            ]}
          />
          <Select
            label={t("settings.language")}
            value={locale}
            onChange={(e) => setLocale(e.target.value as (typeof SUPPORTED_LOCALES)[number])}
            options={SUPPORTED_LOCALES.map((loc) => ({
              value: loc,
              label: loc === "ar" ? "العربية" : loc === "fr" ? "Français" : "English",
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
