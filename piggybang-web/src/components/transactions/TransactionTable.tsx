"use client";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryDot } from "@/components/shared/CategoryPicker";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFormat } from "@/hooks/use-utils";
import type { Transaction } from "@/types";
import { TxAmount, TypeDot, SplitBadge } from "./TransactionRow";

export function TransactionTable({
  transactions,
  canWrite,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[];
  canWrite: boolean;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  const t = useTranslations();
  const f = useFormat();
  return (
    <div className="overflow-hidden rounded-xl border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <span className="sr-only">{t("tx.type")}</span>
            </TableHead>
            <TableHead>{t("tx.date")}</TableHead>
            <TableHead>{t("tx.category")}</TableHead>
            <TableHead>{t("tx.description")}</TableHead>
            <TableHead>{t("tx.actor")}</TableHead>
            <TableHead className="text-right">{t("tx.amount")}</TableHead>
            {canWrite && (
              <TableHead className="w-12">
                <span className="sr-only">{t("common.actions")}</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id} className="animate-in duration-300 fade-in slide-in-from-top-1">
              <TableCell>
                <TypeDot type={tx.type} />
                <span className="sr-only">{t(`tx.${tx.type}`)}</span>
              </TableCell>
              <TableCell className="whitespace-nowrap">{f.date(tx.transaction_time)}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  <CategoryDot category={tx.category} /> {tx.category?.name ?? "—"}
                </span>
              </TableCell>
              <TableCell className="max-w-64 truncate">
                {tx.description}
                <SplitBadge tx={tx} />
              </TableCell>
              <TableCell className="text-muted-foreground">{tx.actor ?? tx.user?.name}</TableCell>
              <TableCell className="text-right">
                <TxAmount tx={tx} />
              </TableCell>
              {canWrite && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(tx)}>
                        <Pencil /> {t("common.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(tx)}>
                        <Trash2 /> {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
