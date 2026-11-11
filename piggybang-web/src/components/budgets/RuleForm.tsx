"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useOrg } from "@/components/layout/AppShell";
import { AmountInput } from "@/components/shared/AmountInput";
import { CategoryPicker } from "@/components/shared/CategoryPicker";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCategories, useOrgMutation } from "@/hooks/api";
import { api } from "@/lib/api";
import type { Rule, RuleType } from "@/types";

export function RuleForm({
  orgId,
  rule,
  defaultType,
  open,
  onOpenChange,
}: {
  orgId: number;
  rule?: Rule;
  defaultType: RuleType;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations();
  const { isPro } = useOrg();
  const [type, setType] = useState<RuleType>(rule?.type ?? defaultType);
  const [name, setName] = useState(rule?.name ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(rule?.category_id ?? null);
  const [amount, setAmount] = useState<number | null>(rule ? Number(rule.limit_amount) : null);
  const [rollover, setRollover] = useState(rule?.rollover_enabled ?? true);
  const [notify, setNotify] = useState(rule?.notify ?? true);
  const [aiAssign, setAiAssign] = useState(rule?.ai_assign ?? true);
  const [day, setDay] = useState(rule?.date_condition ?? "");
  const [keywords, setKeywords] = useState(rule?.category_name ?? "");
  const [primary, setPrimary] = useState(rule?.is_primary_payday ?? true);
  const payday = type === "payday";
  const { data: categories = [] } = useCategories(orgId, payday ? "income" : "expense");

  const save = useOrgMutation(orgId, () =>
    api(rule ? `/organizations/${orgId}/rules/${rule.id}` : `/organizations/${orgId}/rules`, {
      method: rule ? "PATCH" : "POST",
      body: {
        type,
        name,
        category_id: categoryId,
        limit_amount: amount ?? 0,
        period: type === "weekly_limit" ? "weekly" : type === "monthly_limit" ? "monthly" : null,
        rollover_enabled: type === "weekly_limit" ? rollover : false,
        notify: payday ? false : notify,
        ai_assign: aiAssign,
        date_condition: payday ? day : null,
        category_name: keywords.trim() || null,
        is_primary_payday: payday ? primary : false,
      },
    }),
  );

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={rule ? t("budgets.editRule") : t("budgets.newRule")}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await save.mutateAsync();
          onOpenChange(false);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="rule-type">{t("budgets.ruleType")}</Label>
          <Select value={type} onValueChange={(v) => setType(v as RuleType)} disabled={!!rule}>
            <SelectTrigger id="rule-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly_limit">{t("budgets.weekly")}</SelectItem>
              <SelectItem value="monthly_limit">{t("budgets.monthly")}</SelectItem>
              <SelectItem value="payday">{t("budgets.payday")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-name">{t("budgets.ruleName")}</Label>
          <Input id="rule-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="rule-ai">{t("budgets.aiAssignLabel")}</Label>
            <Switch id="rule-ai" checked={aiAssign} onCheckedChange={setAiAssign} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t(payday ? (aiAssign ? "budgets.aiPaydayOnHint" : "budgets.aiPaydayOffHint") : aiAssign ? "budgets.aiAssignOnHint" : "budgets.aiAssignOffHint")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-cat">{t("tx.category")}</Label>
          <CategoryPicker id="rule-cat" categories={categories} value={categoryId} onChange={setCategoryId} onClear={() => setCategoryId(null)} />
          {!payday && <p className="text-xs text-muted-foreground">{t(aiAssign ? "budgets.aiCategoryHint" : "budgets.categoryHint")}</p>}
        </div>
        {!payday && (
          <div className="space-y-1.5">
            <Label htmlFor="rule-limit-kw">{t("budgets.limitKeywords")}</Label>
            <Input id="rule-limit-kw" placeholder="bensin, pertalite, -angin" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t(aiAssign ? "budgets.aiKeywordsHint" : "budgets.limitKeywordsHint")}</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="rule-amount">{payday ? t("budgets.expectedAmount") : t("budgets.limit")}</Label>
          <AmountInput id="rule-amount" value={amount} onChange={setAmount} />
          {!payday && <p className="text-xs text-muted-foreground">{t(type === "weekly_limit" ? "budgets.limitHintWeekly" : "budgets.limitHintMonthly")}</p>}
        </div>
        {type === "weekly_limit" && (
          <div className="space-y-1">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <Label htmlFor="rule-rollover">{t("budgets.rolloverLabel")}</Label>
              <Switch id="rule-rollover" checked={rollover} onCheckedChange={setRollover} />
            </div>
            {!isPro && <p className="text-xs text-muted-foreground">{t("budgets.rolloverProOnly")}</p>}
          </div>
        )}
        {!payday && (
          <div className="space-y-1">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <Label htmlFor="rule-notify">{t("budgets.notifyLabel")}</Label>
              <Switch id="rule-notify" checked={notify} onCheckedChange={setNotify} />
            </div>
            <p className="text-xs text-muted-foreground">{t("budgets.notifyHint")}</p>
          </div>
        )}
        {payday && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="rule-day">{t("budgets.paydayDay")}</Label>
              <Input id="rule-day" type="number" min={1} max={31} required value={day} onChange={(e) => setDay(e.target.value)} className="w-28" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-kw">{t("budgets.keywords")}</Label>
              <Input id="rule-kw" placeholder="gajian, salary, -bonus" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("budgets.paydayKeywordsHint")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="rule-primary" checked={primary} onCheckedChange={(v) => setPrimary(v === true)} />
              <Label htmlFor="rule-primary">{t("budgets.primaryLabel")}</Label>
            </div>
          </>
        )}
        <Button type="submit" className="w-full" disabled={!name || save.isPending}>
          {t("common.save")}
        </Button>
      </form>
    </ResponsiveModal>
  );
}
