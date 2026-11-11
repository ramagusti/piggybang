"use client";
import { useTranslations } from "next-intl";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { TransactionCard } from "@/components/transactions/TransactionCard";
import { useRuleTransactions } from "@/hooks/api";
import { useFormat } from "@/hooks/use-utils";
import type { Rule } from "@/types";

/** What counts toward a budget this payday cycle (cycle start → today). Read-only. */
export function RuleTransactions({ orgId, rule, onOpenChange }: { orgId: number; rule: Rule; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations();
  const f = useFormat();
  const { data, isLoading, error, refetch } = useRuleTransactions(orgId, rule.id);
  const noop = () => {};

  return (
    <ResponsiveModal
      open
      onOpenChange={onOpenChange}
      title={rule.name}
      description={data ? t("budgets.txSince", { date: f.date(data.period_start), total: f.money(data.total), count: data.transactions.length }) : undefined}
    >
      {isLoading ? (
        <LoadingSkeleton variant="list" count={4} />
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data && data.transactions.length > 0 ? (
        <ul className="space-y-2">
          {data.transactions.map((tx) => (
            <TransactionCard key={tx.id} tx={tx} canWrite={false} onEdit={noop} onDelete={noop} />
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("budgets.txNone")}</p>
      )}
    </ResponsiveModal>
  );
}
