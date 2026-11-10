"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AuthCard, FieldError } from "@/components/shared/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const res = await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } });
      setSent(res.message || t("auth.resetSent"));
    } catch (err) {
      setError(err instanceof ApiError ? (err.field("email") ?? err.message) : t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title={t("auth.forgotTitle")}
      footer={
        <Link href="/login" className="text-primary hover:underline">
          ← {t("auth.backToLogin")}
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="rounded-lg bg-success-light p-3 text-sm">
          {sent}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("auth.forgotHint")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldError message={error} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {t("auth.sendResetLink")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
