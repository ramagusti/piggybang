"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useOrg } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { BillCard } from "@/components/bills/BillCard";
import { BillForm } from "@/components/bills/BillForm";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { useBills, useOrgMutation } from "@/hooks/api";
import { api } from "@/lib/api";
import type { Bill } from "@/types";

export default function BillsPage() {
  const t = useTranslations();
  const { org, can } = useOrg();
  const [form, setForm] = useState<{ open: boolean; bill?: Bill }>({ open: false });
  const [confirm, setConfirm] = useState<{ kind: "pay" | "delete"; bill: Bill } | null>(null);
  const { data = [], isLoading, error, refetch } = useBills(org.id);
  const canWrite = can("bills.write");
  const base = `/organizations/${org.id}/bills`;
  const pay = useOrgMutation(org.id, (b: Bill) => api(`${base}/${b.id}/pay`, { method: "POST" }));
  const remove = useOrgMutation(org.id, (b: Bill) => api(`${base}/${b.id}`, { method: "DELETE" }));

  const add = canWrite && (
    <Button onClick={() => setForm({ open: true })}>
      <Plus /> {t("bills.new")}
    </Button>
  );

  async function onConfirm() {
    if (!confirm) return;
    if (confirm.kind === "pay") {
      await pay.mutateAsync(confirm.bill);
      toast.success(t("bills.paidToast", { name: confirm.bill.name }));
    } else await remove.mutateAsync(confirm.bill);
    setConfirm(null);
  }

  return (
    <>
      <PageHeader title={t("nav.bills")} actions={add} />
      {isLoading ? (
        <LoadingSkeleton variant="cards" count={4} />
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title={t("bills.emptyTitle")} description={t("bills.emptyBody")} action={add} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((b) => (
            <BillCard
              key={b.id}
              bill={b}
              canWrite={canWrite}
              onPay={() => setConfirm({ kind: "pay", bill: b })}
              onEdit={() => setForm({ open: true, bill: b })}
              onDelete={() => setConfirm({ kind: "delete", bill: b })}
            />
          ))}
        </div>
      )}
      {form.open && <BillForm key={form.bill?.id ?? "new"} orgId={org.id} bill={form.bill} open onOpenChange={(open) => setForm({ open })} />}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm?.kind === "delete"}
        title={confirm?.kind === "pay" ? t("bills.payConfirm", { name: confirm.bill.name }) : t("common.deleteNamed", { name: confirm?.bill.name ?? "" })}
        description={confirm?.kind === "pay" ? t("bills.payHint") : undefined}
        confirmLabel={confirm?.kind === "pay" ? t("bills.pay") : t("common.delete")}
        loading={pay.isPending || remove.isPending}
        onConfirm={onConfirm}
      />
    </>
  );
}
