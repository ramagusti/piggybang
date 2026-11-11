"use client";
import { useEffect, useState } from "react";
import { Lock, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useOrg } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { fireConfetti } from "@/components/shared/DelightAnimation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { AllInConnectModal } from "@/components/whatsapp/AllInConnectModal";
import { WhatsAppConnectedCard } from "@/components/whatsapp/WhatsAppConnectedCard";
import { WhatsAppStatusCard } from "@/components/whatsapp/WhatsAppStatusCard";
import { useOrgMutation, useWhatsAppConnection } from "@/hooks/api";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";

export default function WhatsAppPage() {
  const t = useTranslations();
  const { org, can, isPro } = useOrg();
  const [allInOpen, setAllInOpen] = useState(false);
  const [linkedAtOpen, setLinkedAtOpen] = useState(0);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const allowed = isPro; // every member links their own phone; managing the connection needs whatsapp.manage
  const manage = can("whatsapp.manage");
  const { data, isLoading, error, refetch } = useWhatsAppConnection(org.id, allInOpen);
  const conn = data?.connection;
  const linked = conn?.linked_senders.length ?? 0;
  // The QR modal closes itself once the poll sees a newly linked phone.
  const justLinked = allInOpen && linked > linkedAtOpen;
  const allInVisible = allInOpen && !justLinked;
  const openLink = () => {
    setLinkedAtOpen(linked);
    setAllInOpen(true);
  };
  const base = `/organizations/${org.id}/whatsapp`;
  const test = useOrgMutation(org.id, () => api<{ message: string }>(`${base}/test`, { method: "POST" }));
  const disconnect = useOrgMutation(org.id, () => api(`${base}/disconnect`, { method: "POST" }));

  useEffect(() => {
    if (justLinked) fireConfetti(true);
  }, [justLinked]);

  let body: React.ReactNode;
  if (!allowed) {
    body = (
      <EmptyState
        piggy="point"
        title={t("whatsapp.proTitle")}
        description={t("whatsapp.proBody")}
        action={
          can("billing.manage") && (
            <Button asChild>
              <Link href="/app/settings?tab=billing">
                <Lock /> {t("billing.upgrade")}
              </Link>
            </Button>
          )
        }
      />
    );
  } else if (isLoading) body = <LoadingSkeleton variant="cards" count={2} />;
  else if (error) body = <ErrorState onRetry={() => refetch()} />;
  else if (conn?.status === "connected") {
    body = (
      <WhatsAppConnectedCard
        connection={conn}
        busy={test.isPending || disconnect.isPending}
        onLink={openLink}
        onTest={manage ? async () => toast.success((await test.mutateAsync()).message) : undefined}
        onDisconnect={manage ? () => setConfirmDisconnect(true) : undefined}
      />
    );
  } else if (conn?.status === "error") {
    body = (
      <section role="alert" className="space-y-3 rounded-xl border border-danger bg-danger-light/40 p-5">
        <p className="flex items-center gap-2 font-semibold text-danger">
          <XCircle aria-hidden /> {t("whatsapp.tokenInvalid")}
        </p>
        <Button onClick={openLink}>{t("common.retry")}</Button>
      </section>
    );
  } else body = <WhatsAppStatusCard onConnect={openLink} />;

  return (
    <>
      <PageHeader title={t("nav.whatsapp")} />
      <div data-tour="wa-connect">{body}</div>
      <AllInConnectModal orgId={org.id} open={allInVisible} onOpenChange={setAllInOpen} />
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={t("whatsapp.disconnectConfirm")}
        confirmLabel={t("whatsapp.disconnect")}
        loading={disconnect.isPending}
        onConfirm={async () => {
          await disconnect.mutateAsync();
          setConfirmDisconnect(false);
          setAllInOpen(false);
        }}
      />
    </>
  );
}
