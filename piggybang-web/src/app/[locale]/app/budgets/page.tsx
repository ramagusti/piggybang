"use client";
import { useState } from "react";
import { Calendar, CalendarDays, Plus, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOrg } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { RuleCard } from "@/components/budgets/RuleCard";
import { RuleForm } from "@/components/budgets/RuleForm";
import { RuleHelp } from "@/components/budgets/RuleHelp";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrgMutation, useRules } from "@/hooks/api";
import { api } from "@/lib/api";
import type { Rule, RuleType } from "@/types";

export default function BudgetsPage() {
  const t = useTranslations();
  const { org, can } = useOrg();
  const [tab, setTab] = useState<RuleType>("weekly_limit");
  const [form, setForm] = useState<{ open: boolean; rule?: Rule }>({ open: false });
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const { data = [], isLoading, error, refetch } = useRules(org.id);
  const canWrite = can("rules.write");
  const list = data.filter((r) => r.type === tab);
  const remove = useOrgMutation(org.id, (r: Rule) => api(`/organizations/${org.id}/rules/${r.id}`, { method: "DELETE" }));

  const add = canWrite && (
    <Button onClick={() => setForm({ open: true })}>
      <Plus /> {t("budgets.newRule")}
    </Button>
  );

  return (
    <>
      <PageHeader title={t("nav.budgets")} actions={add} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as RuleType)}>
        <TabsList>
          <TabsTrigger value="weekly_limit">
            <CalendarDays />
            {t("budgets.weekly")}
          </TabsTrigger>
          <TabsTrigger value="monthly_limit">
            <Calendar />
            {t("budgets.monthly")}
          </TabsTrigger>
          <TabsTrigger value="payday">
            <Wallet />
            {t("budgets.payday")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {/* Opens by itself while a tab has no rules yet. */}
      <RuleHelp key={`${tab}:${isLoading || list.length > 0}`} type={tab} defaultOpen={!isLoading && list.length === 0} />
      {isLoading ? (
        <LoadingSkeleton variant="cards" />
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title={t("budgets.emptyTitle")} description={t("budgets.emptyBody")} action={add} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((r) => (
            <RuleCard key={r.id} rule={r} canWrite={canWrite} onEdit={() => setForm({ open: true, rule: r })} onDelete={() => setDeleting(r)} />
          ))}
        </div>
      )}
      {form.open && <RuleForm key={form.rule?.id ?? `new-${tab}`} orgId={org.id} rule={form.rule} defaultType={tab} open onOpenChange={(open) => setForm({ open })} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("common.deleteNamed", { name: deleting?.name ?? "" })}
        loading={remove.isPending}
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting);
          setDeleting(null);
        }}
      />
    </>
  );
}
