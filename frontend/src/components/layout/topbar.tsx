"use client";

import { useRouter } from "next/navigation";
import { Menu, Moon, Sun, Globe, Bell, LogOut, User } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { SUPPORTED_LOCALES } from "@/lib/constants";

interface TopbarProps {
  t: (key: string) => string;
  onMenuClick: () => void;
}

const localeLabels: Record<string, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export function Topbar({ t, onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const { theme, setTheme, locale, setLocale } = useUIStore();
  const router = useRouter();

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </Button>

        {/* Language Switcher */}
        <Dropdown
          trigger={
            <Button variant="ghost" size="icon" aria-label="Change language">
              <Globe className="h-5 w-5" />
            </Button>
          }
        >
          {SUPPORTED_LOCALES.map((loc) => (
            <DropdownItem
              key={loc}
              onClick={() => setLocale(loc)}
              className={locale === loc ? "bg-accent" : ""}
            >
              {localeLabels[loc] || loc}
            </DropdownItem>
          ))}
        </Dropdown>

        {/* User Menu */}
        <Dropdown
          trigger={
            <button className="flex items-center gap-2 rounded-md p-1 hover:bg-accent cursor-pointer">
              <Avatar
                fallback={user?.name || "U"}
                size="sm"
              />
            </button>
          }
        >
          <div className="px-3 py-2 border-b border-border mb-1">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <DropdownItem onClick={() => router.push("/dashboard/settings/")}>
            <User className="h-4 w-4" />
            {t("settings.profile")}
          </DropdownItem>
          <DropdownItem destructive onClick={async () => {
            await logout();
            window.location.href = "/";
          }}>
            <LogOut className="h-4 w-4" />
            {t("auth.logout")}
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
