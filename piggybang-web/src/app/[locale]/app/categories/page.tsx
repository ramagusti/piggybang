"use client";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useOrg } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryForm } from "@/components/categories/CategoryForm";
import { CategoryList } from "@/components/categories/CategoryList";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCategories, useOrgMutation } from "@/hooks/api";
import { api, ApiError } from "@/lib/api";
import type { Category, TxType } from "@/types";

export default function CategoriesPage() {
  const t = useTranslations();
  const { org, can } = useOrg();
  const [type, setType] = useState<TxType>("expense");
  const [form, setForm] = useState<{ open: boolean; category?: Category }>({ open: false });
  const [deleting, setDeleting] = useState<{ category: Category; count?: number } | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const { data: all = [], isLoading, error, refetch } = useCategories(org.id);
  const list = all.filter((c) => c.type === type);
  const canWrite = can("categories.write");
  const cap = org.limits.categories_per_type;
  const used = type === "expense" ? org.usage.expense_categories : org.usage.income_categories;
  const atCap = cap !== null && used >= cap;
  const base = `/organizations/${org.id}/categories`;

  const patch = useOrgMutation(org.id, ({ c, body }: { c: Category; body: Partial<Category> }) => api(`${base}/${c.id}`, { method: "PATCH", body }));
  const reorder = useOrgMutation(org.id, (ids: number[]) => api(`${base}/reorder`, { method: "POST", body: { ids } }));
  const remove = useOrgMutation(org.id, ({ c, move }: { c: Category; move?: string }) => api(`${base}/${c.id}`, { method: "DELETE", query: { move_to: move } }), { silent: true });

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ c: deleting.category, move: moveTo || undefined });
      setDeleting(null);
      setMoveTo("");
    } catch (e) {
      if (e instanceof ApiError && e.data.code === "has_transactions") setDeleting({ ...deleting, count: Number(e.data.transactions_count) });
      else toast.error((e as Error).message);
    }
  }

  const addButton = canWrite && (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={atCap ? 0 : -1}>
          <Button disabled={atCap} onClick={() => setForm({ open: true })}>
            <Plus /> {t("category.add")}
          </Button>
        </span>
      </TooltipTrigger>
      {atCap && <TooltipContent>{t("billing.upgradeToPro")}</TooltipContent>}
    </Tooltip>
  );

  return (
    <>
      <PageHeader title={t("nav.categories")} actions={addButton} />
      <Tabs value={type} onValueChange={(v) => setType(v as TxType)}>
        <TabsList>
          <TabsTrigger value="expense">
            <ArrowUpRight className="text-danger" />
            {t("tx.expense")}
          </TabsTrigger>
          <TabsTrigger value="income">
            <ArrowDownLeft className="text-success" />
            {t("tx.income")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <LoadingSkeleton count={3} />
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title={t("category.emptyTitle")} action={addButton} />
      ) : (
        <CategoryList
          categories={list}
          canWrite={canWrite}
          onReorder={(ids) => reorder.mutate(ids)}
          onRename={(c, name) => patch.mutate({ c, body: { name } })}
          onColor={(c, color) => patch.mutate({ c, body: { color } })}
          onEdit={(c) => setForm({ open: true, category: c })}
          onDelete={(c) => setDeleting({ category: c, count: c.transactions_count || undefined })}
        />
      )}

      {cap !== null && (
        <div className="max-w-sm space-y-1.5">
          <p className="text-sm text-muted-foreground">{t("category.usage", { used, cap })}</p>
          <Progress value={(used / cap) * 100} aria-label={t("category.usage", { used, cap })} />
        </div>
      )}

      {form.open && (
        <CategoryForm key={form.category?.id ?? "new"} orgId={org.id} type={type} category={form.category} open={form.open} onOpenChange={(open) => setForm({ open })} />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("category.deleteTitle", { name: deleting?.category.name ?? "" })}
        description={deleting?.count ? t("category.deleteHasTx", { count: deleting.count }) : t("category.deleteConfirm")}
        loading={remove.isPending || (!!deleting?.count && !moveTo)}
        onConfirm={confirmDelete}
      >
        {!!deleting?.count && (
          <Select value={moveTo} onValueChange={setMoveTo}>
            <SelectTrigger className="w-full" aria-label={t("category.moveTo")}>
              <SelectValue placeholder={t("category.moveTo")} />
            </SelectTrigger>
            <SelectContent>
              {list
                .filter((c) => c.id !== deleting.category.id)
                .map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </ConfirmDialog>
    </>
  );
}
