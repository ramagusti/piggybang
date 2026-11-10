"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Piggy } from "@/components/piggy/Piggy";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { useHydrated } from "@/hooks/use-utils";
import { api, getToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { Organization } from "@/types";

interface Invitation {
  organization: { id: number; name: string };
  email: string;
  role: string;
}

export default function JoinPage() {
  const t = useTranslations();
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const setCurrentOrg = useAuthStore((s) => s.setCurrentOrg);
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [failed, setFailed] = useState(false);
  const loggedIn = useHydrated() && !!getToken();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api<Invitation>(`/invitations/${token}`).then(setInvite, () => setFailed(true));
  }, [token]);

  async function accept() {
    if (!invite) return;
    setJoining(true);
    try {
      const org = await api<Organization>(`/organizations/${invite.organization.id}/join/${token}`, { method: "POST" });
      setCurrentOrg(org.id);
      await qc.invalidateQueries();
      router.push("/app/dashboard");
    } catch {
      setFailed(true);
      setJoining(false);
    }
  }

  return (
    <main id="main" className="grid min-h-screen place-items-center px-4">
      {failed ? (
        <ErrorState message={t("join.invalid")} />
      ) : !invite ? (
        <Piggy state="fuse" size={96} className="animate-piggy-walk" label={t("common.loading")} />
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <Piggy state="wave" size={110} />
          <h1 className="text-2xl font-bold">{t("join.title", { org: invite.organization.name })}</h1>
          <p className="text-muted-foreground">{t("join.subtitle", { email: invite.email })}</p>
          {loggedIn ? (
            <Button size="lg" onClick={accept} disabled={joining}>
              {t("join.accept")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={`/login?next=/join/${token}`}>{t("auth.login")}</Link>
              </Button>
              <Button asChild>
                <Link href={`/register?invite=${token}`}>{t("auth.register")}</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
