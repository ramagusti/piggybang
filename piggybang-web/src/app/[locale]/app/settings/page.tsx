"use client";
import { Suspense } from "react";
import { Building2, CreditCard, Palette, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useOrg } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppearanceTab } from "@/components/settings/AppearanceTab";
import { BillingTab } from "@/components/settings/BillingTab";
import { OrganizationTab } from "@/components/settings/OrganizationTab";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/api";
import { usePathname, useRouter } from "@/i18n/navigation";

const TABS = ["profile", "organization", "billing", "appearance"] as const;
const ICONS = {
  profile: UserRound,
  organization: Building2,
  billing: CreditCard,
  appearance: Palette,
};

function SettingsTabs() {
  const t = useTranslations();
  const { org, can, isPro } = useOrg();
  const { data: me } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get("tab");
  const tabs = TABS.filter((k) => k !== "billing" || can("billing.manage"));
  const tab = tabs.find((k) => k === requested) ?? "profile";

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => router.replace(`${pathname}?tab=${v}`)}
    >
      <TabsList>
        {tabs.map((k) => {
          const Icon = ICONS[k];
          return (
            <TabsTrigger key={k} value={k}>
              <Icon />
              {t(`settings.tab_${k}`)}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value="profile" className="pt-4">
        {me ? <ProfileTab user={me.user} /> : <LoadingSkeleton />}
      </TabsContent>
      <TabsContent value="organization" className="pt-4">
        <OrganizationTab key={org.id} org={org} isPro={isPro} />
      </TabsContent>
      {can("billing.manage") && (
        <TabsContent value="billing" className="pt-4">
          <BillingTab org={org} />
        </TabsContent>
      )}
      <TabsContent value="appearance" className="pt-4">
        <AppearanceTab />
      </TabsContent>
    </Tabs>
  );
}

export default function SettingsPage() {
  const t = useTranslations();
  return (
    <>
      <PageHeader title={t("nav.settings")} />
      <Suspense>
        <SettingsTabs />
      </Suspense>
    </>
  );
}
