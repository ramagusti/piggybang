"use client";
import { useState } from "react";
import { CreditCard, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { CheckoutDialog } from "@/components/settings/BillingTab";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/hooks/api";
import { useFormat } from "@/hooks/use-utils";
import { api } from "@/lib/api";
import { TIERS } from "@/lib/plans";
import { useAuthStore } from "@/stores/auth";
import type { Organization } from "@/types";

/** Shown instead of the app for an extra team without a paid plan (each user gets one free team). */
export function LockedTeam({ org }: { org: Organization }) {
  const t = useTranslations();
  const f = useFormat();
  const qc = useQueryClient();
  const setCurrentOrg = useAuthStore((s) => s.setCurrentOrg);
  const [checkout, setCheckout] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canPay = org.permissions.includes("billing.manage");

  return (
    <>
      <EmptyState
        piggy="point"
        title={t("org.lockedTitle", { name: org.name })}
        description={canPay ? t("org.lockedBody", { price: f.money(TIERS[0].monthly) }) : t("org.lockedAskOwner")}
        action={
          canPay && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setCheckout(true)}>
                <CreditCard /> {t("org.lockedCta")}
              </Button>
              {org.permissions.includes("organization.delete") && (
                <Button variant="outline" onClick={() => setDeleting(true)}>
                  <Trash2 /> {t("settings.deleteOrg")}
                </Button>
              )}
            </div>
          )
        }
      />
      {checkout && <CheckoutDialog orgId={org.id} open onOpenChange={setCheckout} />}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("settings.deleteOrg")}
        description={t("settings.deleteOrgConfirm", { name: org.name })}
        onConfirm={async () => {
          await api(`/organizations/${org.id}`, { method: "DELETE" });
          setCurrentOrg(null);
          await qc.invalidateQueries({ queryKey: queryKeys.organizations });
          setDeleting(false);
        }}
      />
    </>
  );
}
