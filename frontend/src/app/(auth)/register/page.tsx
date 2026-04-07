"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Store } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { t } = useI18n();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    phone: "",
    store_name: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) errors.name = "Name is required";
    if (!formData.email.trim()) errors.email = "Email is required";
    if (formData.password.length < 8)
      errors.password = "Password must be at least 8 characters";
    if (formData.password !== formData.password_confirmation)
      errors.password_confirmation = "Passwords do not match";
    if (!formData.store_name.trim())
      errors.store_name = "Store name is required";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    setIsLoading(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        password_confirmation: formData.password_confirmation,
        phone: formData.phone,
        store_name: formData.store_name,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("errors.generic");
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">{t("auth.register_title")}</CardTitle>
          <CardDescription>COD CRM</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Input
              label={t("auth.store_name")}
              placeholder="My Store"
              value={formData.store_name}
              onChange={(e) => updateField("store_name", e.target.value)}
              error={fieldErrors.store_name}
              required
            />

            <Input
              label={t("auth.name")}
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              error={fieldErrors.name}
              required
            />

            <Input
              label={t("auth.email")}
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              error={fieldErrors.email}
              required
              autoComplete="email"
            />

            <Input
              label={t("auth.phone")}
              type="tel"
              placeholder="05XXXXXXXX"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              error={fieldErrors.phone}
            />

            <Input
              label={t("auth.password")}
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => updateField("password", e.target.value)}
              error={fieldErrors.password}
              required
              autoComplete="new-password"
            />

            <Input
              label={t("auth.confirm_password")}
              type="password"
              placeholder="••••••••"
              value={formData.password_confirmation}
              onChange={(e) =>
                updateField("password_confirmation", e.target.value)
              }
              error={fieldErrors.password_confirmation}
              required
              autoComplete="new-password"
            />
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              {t("auth.register")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("auth.has_account")}{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                {t("auth.login")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
