"use client";
import { Suspense, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter as useRawRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AuthCard, FieldError } from "@/components/shared/AuthCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { api, ApiError, setToken } from "@/lib/api";
import { safeNext } from "@/lib/utils";
import type { User } from "@/types";

function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const rawRouter = useRawRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ user: User; token: string }>("/auth/login", { method: "POST", body: { email, password, remember } });
      setToken(res.token, remember);
      qc.clear();
      const next = safeNext(params.get("next"));
      if (next) rawRouter.push(next);
      else router.push("/app/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, { message: t("common.networkError") }));
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title={t("auth.loginTitle")}
      footer={
        <>
          <p>
            <Link href="/forgot-password" className="text-primary hover:underline">
              {t("auth.forgotPassword")}
            </Link>
          </p>
          <p>
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              {t("auth.register")}
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby="email-error" aria-invalid={!!error?.field("email") || undefined} />
          <FieldError id="email-error" message={error?.field("email")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" />
            <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0" aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")} onClick={() => setShow(!show)}>
              {show ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          <Label htmlFor="remember">{t("auth.remember")}</Label>
        </div>
        {error && !error.data.errors && <FieldError message={error.message} />}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("common.loading") : t("auth.login")}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
