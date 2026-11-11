"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Piggy } from "@/components/piggy/Piggy";
import { EmptyState } from "@/components/shared/EmptyState";
import { InstallButton } from "@/components/shared/InstallButton";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { Tour } from "@/components/tour/Tour";
import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/api";
import { useRealtime } from "@/hooks/use-realtime";
import { useHydrated } from "@/hooks/use-utils";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { getToken } from "@/lib/api";
import type { Organization, Permission } from "@/types";
import { MobileTabBar } from "./MobileTabBar";
import { Navbar } from "./Navbar";
import { LockedTeam } from "./LockedTeam";
import { CreateOrgDialog } from "./OrgSwitcher";
import { Sidebar } from "./Sidebar";

const OrgContext = createContext<Organization | null>(null);

/** Current org inside /app (AppShell guarantees it is loaded). */
export function useOrg() {
  const org = useContext(OrgContext);
  if (!org) throw new Error("useOrg outside AppShell");
  return { org, can: (p: Permission) => org.permissions.includes(p), isPro: org.effective_plan === "pro" };
}

export function FullScreenLoader() {
  const t = useTranslations();
  return (
    <div className="grid min-h-screen place-items-center">
      <Piggy state="fuse" size={96} className="animate-piggy-walk" label={t("common.loading")} />
    </div>
  );
}

function TrialBanner({ org }: { org: Organization }) {
  const t = useTranslations();
  const [now] = useState(Date.now);
  if (!org.is_trialing || !org.trial_ends_at) return null;
  const days = Math.ceil((new Date(org.trial_ends_at).getTime() - now) / 864e5);
  if (days > 3) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-strong bg-warning-bg p-3">
      <Piggy state="point" size={44} />
      <p className="flex-1 text-sm font-medium">{t("billing.trialEnding", { days: Math.max(days, 0) })}</p>
      {org.permissions.includes("billing.manage") && (
        <Button size="sm" asChild>
          <Link href="/app/settings?tab=billing">{t("billing.upgrade")}</Link>
        </Button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useHydrated();
  const [creating, setCreating] = useState(false);
  const { org, isLoading, error, refetch } = useCurrentOrg();
  useRealtime(org?.id);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  const needsOnboarding = !!org && !org.locked && !org.settings?.onboarded && !pathname.startsWith("/app/onboarding");
  useEffect(() => {
    if (needsOnboarding && org?.permissions.includes("rules.write")) router.replace("/app/onboarding");
  }, [needsOnboarding, org, router]);

  if (!mounted || isLoading) return <FullScreenLoader />;
  if (error) return <ErrorState onRetry={() => refetch()} />;
  if (!org) {
    return (
      <main id="main" className="grid min-h-screen place-items-center">
        <EmptyState
          piggy="wave"
          title={t("org.noneTitle")}
          description={t("org.noneBody")}
          action={<Button onClick={() => setCreating(true)}>{t("org.create")}</Button>}
        />
        <CreateOrgDialog open={creating} onOpenChange={setCreating} />
      </main>
    );
  }
  if (org.locked) {
    // Extra team without a paid plan: keep the navbar (team switcher, logout), block everything else.
    return (
      <OrgContext.Provider value={org}>
        <Navbar />
        <main id="main" className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
          <LockedTeam org={org} />
        </main>
      </OrgContext.Provider>
    );
  }
  if (pathname.startsWith("/app/onboarding")) {
    return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>;
  }

  return (
    <OrgContext.Provider value={org}>
      <Navbar />
      <div className="flex">
        <Sidebar showUpgrade={org.effective_plan === "free"} />
        <main id="main" className="min-w-0 flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">
          <div className="mx-auto max-w-7xl space-y-6">
            <TrialBanner org={org} />
            <div key={pathname} className="animate-in space-y-6 fade-in-0 slide-in-from-bottom-2 duration-300 ease-out">
              {children}
            </div>
          </div>
        </main>
      </div>
      <MobileTabBar />
      <InstallButton />
      <Tour />
    </OrgContext.Provider>
  );
}
