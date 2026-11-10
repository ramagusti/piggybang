"use client";
import { useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Category, TxFilters } from "@/types";

export function TransactionFilters({
  filters,
  categories,
  onChange,
}: {
  filters: TxFilters;
  categories: Category[];
  onChange: (f: TxFilters) => void;
}) {
  const t = useTranslations();
  const [q, setQ] = useState(filters.q ?? "");
  const [sheet, setSheet] = useState(false);

  // Debounce search.
  useEffect(() => {
    const id = setTimeout(() => q !== (filters.q ?? "") && onChange({ ...filters, q: q || undefined, page: 1 }), 300);
    return () => clearTimeout(id);
  }, [q, filters, onChange]);

  const set = (patch: TxFilters) => onChange({ ...filters, ...patch, page: 1 });

  const chips = (
    <div className="flex gap-2" role="radiogroup" aria-label={t("tx.type")}>
      {([undefined, "expense", "income"] as const).map((type) => (
        <button
          key={type ?? "all"}
          type="button"
          role="radio"
          aria-checked={filters.type === type}
          onClick={() => {
            const keep = !type || categories.find((c) => c.id === filters.category_id)?.type === type;
            set({ type, category_id: keep ? filters.category_id : undefined });
          }}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
            filters.type === type ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted",
          )}
        >
          {type ? t(`tx.${type}`) : t("filters.all")}
        </button>
      ))}
    </div>
  );

  const advanced = (
    <>
      <DateRangePicker from={filters.from} to={filters.to} onChange={(r) => set(r)} />
      <Select value={filters.category_id ? String(filters.category_id) : "all"} onValueChange={(v) => set({ category_id: v === "all" ? undefined : Number(v) })}>
        <SelectTrigger className="w-full md:w-56" aria-label={t("tx.category")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filters.allCategories")}</SelectItem>
          {categories
            .filter((c) => !filters.type || c.type === filters.type)
            .map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.icon} {c.name}
                <span className={cn("text-xs font-medium", c.type === "expense" ? "text-danger" : "text-success")}>{t(`tx.${c.type}`)}</span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div className="space-y-3">
      {chips}
      <div className="flex flex-col gap-3 rounded-xl border bg-surface p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label={t("common.search")} placeholder={`${t("common.search")}...`} className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="hidden items-center gap-3 md:flex">{advanced}</div>
        <Button variant="outline" className="md:hidden" onClick={() => setSheet(true)}>
          <SlidersHorizontal /> {t("filters.title")}
        </Button>
      </div>
      <ResponsiveModal open={sheet} onOpenChange={setSheet} title={t("filters.title")}>
        <div className="space-y-4">{advanced}</div>
        <Button className="mt-4 w-full" onClick={() => setSheet(false)}>
          {t("filters.apply")}
        </Button>
      </ResponsiveModal>
    </div>
  );
}
