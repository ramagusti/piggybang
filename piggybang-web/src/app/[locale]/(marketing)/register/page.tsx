"use client";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Piggy } from "@/components/piggy/Piggy";
import { AuthCard, FieldError } from "@/components/shared/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { api, ApiError, setToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { Organization, User } from "@/types";

function RegisterForm() {
  const t = useTranslations();
  const qc = useQueryClient();
  const invite = useSearchParams().get("invite");
  const setCurrentOrg = useAuthStore((s) => s.setCurrentOrg);
  const [step, setStep] = useState<1 | 2 | "done">(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", organization_name: "" });
  const [inviteInfo, setInviteInfo] = useState<{ organization: { name: string }; email: string } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!invite) return;
    api<{ organization: { id: number; name: string }; email: string }>(`/invitations/${invite}`)
      .then((info) => {
        setInviteInfo(info);
        setForm((f) => ({ ...f, email: info.email }));
      })
      .catch(() => {});
  }, [invite]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (form.name && form.email && form.password.length >= 8) setStep(2);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ user: User; token: string; organization: Organization }>("/auth/register", {
        method: "POST",
        body: { ...form, organization_name: form.organization_name || undefined, invitation_token: invite ?? undefined },
      });
      setToken(res.token);
      qc.clear();
      if (res.organization) setCurrentOrg(res.organization.id);
      setStep("done");
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(0, { message: t("common.networkError") });
      setError(apiErr);
      if (apiErr.field("email") || apiErr.field("password") || apiErr.field("name")) setStep(1);
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <main id="main" className="grid min-h-screen place-items-center px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <Piggy state="wave" size={120} />
          <h1 className="text-2xl font-bold">{t("auth.checkEmailTitle")}</h1>
          <p className="text-muted-foreground">{t("auth.checkEmailBody", { email: form.email })}</p>
          <Button asChild>
            <Link href="/app/dashboard">{t("auth.continue")}</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <AuthCard
      title={t("auth.registerTitle")}
      footer={
        <p>
          {t("auth.haveAccount")}{" "}
          <Link href={invite ? `/login?next=/join/${invite}` : "/login"} className="font-medium text-primary hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      }
    >
      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {t("auth.step", { step, total: 2 })} · {step === 1 ? t("auth.stepAccount") : t("auth.stepTeam")}
      </p>
      {inviteInfo && <p className="mb-4 rounded-lg bg-primary-bg p-3 text-sm">{t("auth.invitedTo", { org: inviteInfo.organization.name })}</p>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        {step === 1 ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("auth.fullName")}</Label>
              <Input id="name" autoComplete="name" required value={form.name} onChange={set("name")} />
              <FieldError message={error?.field("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} aria-describedby="email-err" />
              <FieldError id="email-err" message={error?.field("email")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set("password")} aria-describedby="pw-hint" />
              <p id="pw-hint" className="text-xs text-muted-foreground">
                {t("auth.passwordHint")}
              </p>
              <FieldError message={error?.field("password")} />
            </div>
            <Button type="submit" className="w-full">
              {t("common.next")} →
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="org">{t("auth.teamName")}</Label>
              <Input id="org" required={!invite} placeholder={t("auth.teamPlaceholder")} value={form.organization_name} onChange={set("organization_name")} aria-describedby="org-hint" />
              <p id="org-hint" className="text-xs text-muted-foreground">
                {invite ? t("auth.teamOptional") : t("auth.teamHint")}
              </p>
              <FieldError message={error?.field("organization_name")} />
            </div>
            {error && !error.data.errors && <FieldError message={error.message} />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                ← {t("common.back")}
              </Button>
              <Button type="submit" className="flex-1" disabled={loading || (!invite && !form.organization_name)}>
                {loading ? t("common.loading") : t("auth.createAccount")}
              </Button>
            </div>
          </>
        )}
      </form>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
