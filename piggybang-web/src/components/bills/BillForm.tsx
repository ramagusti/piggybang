"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AmountInput } from "@/components/shared/AmountInput";
import { CategoryPicker } from "@/components/shared/CategoryPicker";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories, useOrgMutation } from "@/hooks/api";
import { api } from "@/lib/api";
import type { Bill } from "@/types";

const RECURRENCES = ["monthly", "quarterly", "yearly", "one_time"] as const;

export function BillForm({ orgId, bill, open, onOpenChange }: { orgId: number; bill?: Bill; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const { data: categories = [] } = useCategories(orgId, "expense");
  const [v, setV] = useState({
    name: bill?.name ?? "",
    amount: bill ? Number(bill.amount) : (null as number | null),
    due_date: bill?.due_date?.slice(0, 10) ?? "",
    recurrence: bill?.recurrence ?? ("monthly" as Bill["recurrence"]),
    category_id: bill?.category_id ?? (null as number | null),
    destination_account: bill?.destination_account ?? "",
    destination_number: bill?.destination_number ?? "",
  });
  const save = useOrgMutation(orgId, () =>
    api(bill ? `/organizations/${orgId}/bills/${bill.id}` : `/organizations/${orgId}/bills`, {
      method: bill ? "PATCH" : "POST",
      body: { ...v, destination_account: v.destination_account || null, destination_number: v.destination_number || null },
    }),
  );

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={bill ? t("bills.edit") : t("bills.new")}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await save.mutateAsync();
          onOpenChange(false);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="bill-name">{t("bills.name")}</Label>
          <Input id="bill-name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill-amount">{t("tx.amount")}</Label>
          <AmountInput id="bill-amount" value={v.amount} onChange={(amount) => setV({ ...v, amount })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bill-due">{t("bills.dueDate")}</Label>
            <Input id="bill-due" type="date" required value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bill-rec">{t("bills.recurrence")}</Label>
            <Select value={v.recurrence} onValueChange={(r) => setV({ ...v, recurrence: r as Bill["recurrence"] })}>
              <SelectTrigger id="bill-rec" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`bills.rec_${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill-cat">{t("tx.category")}</Label>
          <CategoryPicker id="bill-cat" categories={categories} value={v.category_id} onChange={(category_id) => setV({ ...v, category_id })} />
          {!v.category_id && <p className="text-xs text-muted-foreground">{t("bills.categoryAuto")}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bill-acc">{t("bills.destinationAccount")}</Label>
            <Input id="bill-acc" placeholder="BCA / GoPay" value={v.destination_account} onChange={(e) => setV({ ...v, destination_account: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bill-num">{t("bills.destinationNumber")}</Label>
            <Input id="bill-num" inputMode="numeric" value={v.destination_number} onChange={(e) => setV({ ...v, destination_number: e.target.value })} />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={!v.name || !v.amount || !v.due_date || save.isPending}>
          {t("common.save")}
        </Button>
      </form>
    </ResponsiveModal>
  );
}
