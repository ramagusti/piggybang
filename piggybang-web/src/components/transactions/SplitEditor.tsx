"use client";
import { Equal, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AmountInput } from "@/components/shared/AmountInput";
import { CategoryPicker } from "@/components/shared/CategoryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormat } from "@/hooks/use-utils";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

export interface SplitPart {
  key: number;
  amount: number | null;
  categoryId: number | null;
  actor: string;
}

let nextKey = 1;
export const newPart = (p: Partial<SplitPart> = {}): SplitPart => ({ key: nextKey++, amount: null, categoryId: null, actor: "", ...p });

/** Equal shares in whole rupiah; the remainder goes to the first part so the sum is exact. */
export function splitEvenly(total: number, n: number): number[] {
  const share = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? total - share * (n - 1) : share));
}

/** Split bill: one payment divided into parts, each with its own amount, category and person. */
export function SplitEditor({
  total,
  parts,
  onChange,
  categories,
  people,
}: {
  total: number | null;
  parts: SplitPart[];
  onChange: (p: SplitPart[]) => void;
  categories: Category[];
  people: string[];
}) {
  const t = useTranslations("split");
  const f = useFormat();
  const sum = parts.reduce((s, p) => s + (p.amount ?? 0), 0);
  const diff = Math.round(((total ?? 0) - sum) * 100) / 100;
  const set = (key: number, patch: Partial<SplitPart>) => onChange(parts.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  return (
    <div className="animate-in space-y-3 rounded-xl border bg-muted/30 p-3 fade-in-0 slide-in-from-top-1 duration-200">
      <datalist id="split-people">
        {people.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <ol className="space-y-3">
        {parts.map((p, i) => (
          <li key={p.key} className="space-y-2 rounded-lg border bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{t("part", { n: i + 1 })}</span>
              {parts.length > 2 && (
                <button
                  type="button"
                  aria-label={t("remove", { n: i + 1 })}
                  onClick={() => onChange(parts.filter((x) => x.key !== p.key))}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <AmountInput aria-label={t("amount", { n: i + 1 })} value={p.amount} onChange={(amount) => set(p.key, { amount })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <CategoryPicker categories={categories} value={p.categoryId} onChange={(categoryId) => set(p.key, { categoryId })} />
              <Input list="split-people" aria-label={t("person", { n: i + 1 })} placeholder={t("personPlaceholder")} value={p.actor} onChange={(e) => set(p.key, { actor: e.target.value })} />
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...parts, newPart({ categoryId: parts[0]?.categoryId ?? null })])} disabled={parts.length >= 20}>
          <Plus /> {t("add")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!total}
          onClick={() => {
            const shares = splitEvenly(total!, parts.length);
            onChange(parts.map((p, i) => ({ ...p, amount: shares[i] })));
          }}
        >
          <Equal /> {t("even")}
        </Button>
        <p role="status" className={cn("ml-auto text-sm font-medium tabular-nums", diff === 0 ? "text-success" : "text-danger")}>
          {diff === 0 ? t("balanced") : diff > 0 ? t("left", { amount: f.money(diff) }) : t("over", { amount: f.money(-diff) })}
        </p>
      </div>
    </div>
  );
}
