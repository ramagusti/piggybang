"use client";
import { useTranslations } from "next-intl";
import { CategoryDot } from "@/components/shared/CategoryPicker";
import { useFormat } from "@/hooks/use-utils";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

export function TxAmount({ tx, compact }: { tx: Transaction; compact?: boolean }) {
  const f = useFormat();
  const signed = tx.type === "expense" ? -Number(tx.amount) : Number(tx.amount);
  return (
    <span className={cn("font-semibold whitespace-nowrap tabular-nums", tx.type === "expense" ? "text-danger" : "text-success")}>
      {f.money(signed, { currency: tx.currency, compact, sign: true })}
    </span>
  );
}

export function TypeDot({ type }: { type: Transaction["type"] }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", type === "expense" ? "bg-danger" : "bg-success")} aria-hidden />;
}

/** "Part 1/3 of Rp 300.000" for transactions created by split bill. */
export function SplitBadge({ tx }: { tx: Transaction }) {
  const t = useTranslations("split");
  const f = useFormat();
  if (!tx.split) return null;
  return (
    <span className="ml-1.5 inline-block rounded-md bg-primary-bg px-1.5 py-0.5 align-middle text-[11px] font-medium whitespace-nowrap text-primary">
      {t("badge", { part: tx.split.part, of: tx.split.of, total: f.money(tx.split.total) })}
    </span>
  );
}

/** Compact one-line row (dashboard recent list). */
export function TransactionRow({ tx }: { tx: Transaction }) {
  return (
    <li className="flex min-h-12 animate-in items-center gap-3 py-2 duration-300 fade-in slide-in-from-top-2">
      <TypeDot type={tx.type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-medium">
            <CategoryDot category={tx.category} /> {tx.category?.name ?? "—"}
          </span>
          {tx.description && <span className="text-muted-foreground"> · {tx.description}</span>}
          <SplitBadge tx={tx} />
        </p>
      </div>
      <TxAmount tx={tx} />
    </li>
  );
}
