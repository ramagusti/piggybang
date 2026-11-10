"use client";
import { CheckCircle2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Piggy } from "@/components/piggy/Piggy";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useFormat } from "@/hooks/use-utils";
import { cn } from "@/lib/utils";
import type { Bill } from "@/types";

const BORDER: Record<Bill["status"], string> = {
  overdue: "border-l-4 border-l-danger animate-pulse-glow",
  due_soon: "border-l-4 border-l-danger animate-pulse-glow",
  upcoming: "border-l-4 border-l-warning",
  normal: "",
  paid: "opacity-60",
};

export function BillCard({
  bill,
  canWrite,
  onPay,
  onEdit,
  onDelete,
}: {
  bill: Bill;
  canWrite: boolean;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const f = useFormat();
  const paid = bill.status === "paid";
  const urgent = bill.status === "overdue" || bill.status === "due_soon";
  const due =
    bill.status === "overdue"
      ? t("bills.overdue", { days: Math.abs(bill.days_until_due) })
      : bill.days_until_due === 0
        ? t("bills.today")
        : t("bills.inDays", { days: bill.days_until_due });

  return (
    <div className={cn("card-hover flex flex-col gap-2 rounded-xl border bg-surface p-5", BORDER[bill.status])} data-status={bill.status}>
      <div className="flex items-start gap-2">
        <p className={cn("flex-1 font-semibold", paid && "line-through")}>
          {paid && <CheckCircle2 className="mr-1 inline size-4 text-success" aria-label={t("bills.paid")} />}
          {bill.name}
        </p>
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> {t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 /> {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <p className={cn("text-xl font-bold tabular-nums", paid && "line-through")}>{f.money(bill.amount, { currency: bill.currency })}</p>
      <p className={cn("text-sm font-medium", urgent ? "text-danger uppercase" : bill.status === "upcoming" ? "text-warning" : "text-muted-foreground")}>
        {paid ? t("bills.paidOn", { date: f.date(bill.last_paid_at) }) : due}
      </p>
      {(bill.destination_account || bill.destination_number) && (
        <p className="text-sm text-muted-foreground">
          {t("bills.via")}: {[bill.destination_account, bill.destination_number].filter(Boolean).join(" · ")}
        </p>
      )}
      {urgent && !paid && <Piggy state="point" size={40} message={t("bills.dontForget")} />}
      {canWrite && !paid && (
        <Button variant={urgent ? "default" : "outline"} className="mt-auto self-end" onClick={onPay}>
          {t("bills.pay")}
        </Button>
      )}
    </div>
  );
}
