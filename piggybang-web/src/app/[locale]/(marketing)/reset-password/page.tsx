"use client";
import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { AuthCard, FieldError } from "@/components/shared/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";

function ResetForm() {
  const t = useTranslations();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError(t("auth.passwordMismatch"));
    setLoading(true);
    setError(undefined);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { token: params.get("token"), email: params.get("email"), password, password_confirmation: confirm },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? (err.field("password") ?? err.field("email") ?? err.message) : t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title={t("auth.resetTitle")}>
      {done ? (
        <div className="space-y-4">
          <p role="status" className="rounded-lg bg-success-light p-3 text-sm">
            {t("auth.resetDone")}
          </p>
          <Button asChild className="w-full">
            <Link href="/login">{t("auth.login")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.newPassword")}</Label>
            <Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
            <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <FieldError message={error} />
          <Button type="submit" className="w-full" disabled={loading}>
            {t("auth.resetSubmit")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
