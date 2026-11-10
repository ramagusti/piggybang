"use client";
import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryDot } from "@/components/shared/CategoryPicker";
import { useFormat } from "@/hooks/use-utils";
import type { Transaction } from "@/types";
import { TxAmount, TypeDot, SplitBadge } from "./TransactionRow";

const SWIPE_DELETE_PX = 96;

/** Mobile card. Tap → edit, swipe left → delete (undo via toast in parent). */
export function TransactionCard({ tx, canWrite, onEdit, onDelete }: { tx: Transaction; canWrite: boolean; onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations();
  const f = useFormat();
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const swiped = useRef(false);

  const touch = canWrite
    ? {
        onTouchStart: (e: React.TouchEvent) => {
          start.current = e.touches[0].clientX;
          setDragging(true);
        },
        onTouchMove: (e: React.TouchEvent) => start.current !== null && setDx(Math.min(0, e.touches[0].clientX - start.current)),
        onTouchEnd: () => {
          swiped.current = dx < -10;
          if (dx < -SWIPE_DELETE_PX) {
            navigator.vibrate?.(10);
            onDelete();
          }
          setDx(0);
          setDragging(false);
          start.current = null;
        },
      }
    : {};

  return (
    <li className="relative animate-in overflow-hidden rounded-xl duration-300 fade-in slide-in-from-top-2">
      <div className="absolute inset-0 flex items-center justify-end rounded-xl bg-danger px-5 text-white" aria-hidden>
        <Trash2 />
      </div>
      <button
        type="button"
        disabled={!canWrite}
        onClick={() => (swiped.current ? (swiped.current = false) : onEdit())}
        {...touch}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform 200ms" }}
        className="relative flex w-full gap-3 rounded-xl border bg-surface p-4 text-left disabled:opacity-100"
        aria-label={`${tx.category?.name ?? ""} ${tx.description ?? ""}`}
      >
        <TypeDot type={tx.type} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium">
            <CategoryDot category={tx.category} /> {tx.category?.name ?? "—"}
          </p>
          {(tx.description || tx.split) && (
            <p className="truncate text-sm text-muted-foreground">
              {tx.description}
              <SplitBadge tx={tx} />
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {[tx.actor ?? tx.user?.name, f.date(tx.transaction_time)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="self-end">
          <TxAmount tx={tx} />
        </div>
      </button>
      {canWrite && <span className="sr-only">{t("tx.swipeHint")}</span>}
    </li>
  );
}
