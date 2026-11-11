"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOrg } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ImportDialog } from "@/components/transactions/ImportDialog";
import { TransactionCard } from "@/components/transactions/TransactionCard";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionDialog } from "@/components/transactions/TransactionForm";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { queryKeys, useCategories, useTransactions } from "@/hooks/api";
import { api, download } from "@/lib/api";
import { useUIStore } from "@/stores/ui";
import type { Paginated, Transaction, TxFilters } from "@/types";

const UNDO_MS = 5000;

export default function TransactionsPage() {
  const t = useTranslations();
  const { org, can } = useOrg();
  const qc = useQueryClient();
  const resetNewTx = useUIStore((s) => s.resetNewTx);
  const [filters, setFilters] = useState<TxFilters>({ page: 1, per_page: 20 });
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { data, isLoading, error, refetch } = useTransactions(org.id, filters);
  const { data: categories = [] } = useCategories(org.id);
  const canWrite = can("transactions.write");
  const onFilters = useCallback((f: TxFilters) => setFilters(f), []);

  useEffect(() => resetNewTx(), [resetNewTx, data]);

  /** Optimistic remove + undo toast; the API call fires after the undo window (spec §6.3, §3.14). */
  function remove(tx: Transaction) {
    const key = queryKeys.transactions(org.id, filters);
    const previous = qc.getQueryData<Paginated<Transaction>>(key);
    qc.setQueryData<Paginated<Transaction>>(key, (old) => old && { ...old, data: old.data.filter((x) => x.id !== tx.id) });
    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      try {
        await api(`/organizations/${org.id}/transactions/${tx.id}`, { method: "DELETE" });
      } catch {
        qc.setQueryData(key, previous);
        toast.error(t("tx.deleteFailed"));
      }
      qc.invalidateQueries({ queryKey: queryKeys.org(org.id) });
    }, UNDO_MS);
    toast(t("tx.deleted"), {
      duration: UNDO_MS,
      action: {
        label: t("common.undo"),
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          qc.setQueryData(key, previous);
        },
      },
    });
  }

  const openNew = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const exportAs = (format: "csv" | "pdf") =>
    download(`/organizations/${org.id}/export/transactions`, { format, from: filters.from, to: filters.to }, `transactions.${format}`).catch((e) => toast.error(e.message));

  const list = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader
        title={t("nav.transactions")}
        actions={
          <>
            {canWrite && (
              <Button onClick={openNew}>
                <Plus /> {t("tx.add")}
              </Button>
            )}
            {canWrite && (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload /> {t("tx.import")}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download /> {t("tx.export")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => exportAs("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportAs("pdf")}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <TransactionFilters filters={filters} categories={categories} onChange={onFilters} />

      {isLoading ? (
        <LoadingSkeleton variant="table" count={6} />
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          title={t("tx.emptyTitle")}
          description={t("tx.emptyBody")}
          action={
            canWrite && (
              <Button onClick={openNew}>
                <Plus /> {t("tx.add")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <TransactionTable
              transactions={list}
              canWrite={canWrite}
              onEdit={(tx) => {
                setEditing(tx);
                setFormOpen(true);
              }}
              onDelete={remove}
            />
          </div>
          <ul className="space-y-2 md:hidden">
            {list.map((tx) => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                canWrite={canWrite}
                onEdit={() => {
                  setEditing(tx);
                  setFormOpen(true);
                }}
                onDelete={() => remove(tx)}
              />
            ))}
          </ul>
        </>
      )}

      {meta && meta.last_page > 1 && (
        <nav className="flex items-center justify-between gap-2" aria-label={t("common.pagination")}>
          <Button variant="outline" disabled={meta.current_page <= 1} onClick={() => setFilters({ ...filters, page: meta.current_page - 1 })}>
            ← {t("common.prev")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("common.pageOf", { page: meta.current_page, total: meta.last_page })}</span>
          <Button variant="outline" disabled={meta.current_page >= meta.last_page} onClick={() => setFilters({ ...filters, page: meta.current_page + 1 })}>
            {t("common.next")} →
          </Button>
        </nav>
      )}

      <TransactionDialog open={formOpen} onOpenChange={setFormOpen} transaction={editing} onDelete={canWrite ? remove : undefined} />
      <ImportDialog orgId={org.id} open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
