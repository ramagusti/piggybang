"use client";
import { useState } from "react";
import { MessageCircle, PenLine, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Piggy } from "@/components/piggy/Piggy";
import { AmountInput } from "@/components/shared/AmountInput";
import { fireConfetti } from "@/components/shared/DelightAnimation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { queryKeys, useCategories } from "@/hooks/api";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type { Organization } from "@/types";

const PRESET_CATEGORIES = ["Food & Beverages", "Transportation", "Kid's Stuff", "Bills & Subscriptions", "Health, Selfcare & Beauty", "Apparels & Wearables"];
const PRESET_BUDGETS: { name: string; limit_amount: number | null }[] = [
  { name: "Daily Meals", limit_amount: 500000 },
  { name: "Bensin Motor", limit_amount: 65000 },
];
const PAYDAYS = ["1", "15", "25", "26"];

export function OnboardingWizard({ org }: { org: Organization }) {
  const t = useTranslations();
  const qc = useQueryClient();
  const { data: existing = [] } = useCategories(org.id, "expense");
  const [step, setStep] = useState<1 | 2 | 3 | "done">(1);
  const [picked, setPicked] = useState<string[]>(PRESET_CATEGORIES);
  const [custom, setCustom] = useState("");
  const [budgets, setBudgets] = useState(PRESET_BUDGETS);
  const [payday, setPayday] = useState<string>("");
  const [otherDay, setOtherDay] = useState("");
  const [saving, setSaving] = useState(false);

  const allCats = Array.from(new Set([...PRESET_CATEGORIES, ...picked]));
  const toggle = (name: string) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));

  async function finish(skipPayday = false) {
    setSaving(true);
    const names = new Set(existing.map((c) => c.name.toLowerCase()));
    const day = skipPayday ? null : payday === "other" ? Number(otherDay) || null : Number(payday) || null;
    try {
      await api(`/organizations/${org.id}/onboarding`, {
        method: "POST",
        body: {
          categories: picked.filter((n) => !names.has(n.toLowerCase())).map((name) => ({ type: "expense", name })),
          budgets: budgets.filter((b) => b.name && b.limit_amount),
          payday_day: day,
        },
      });
      await qc.invalidateQueries({ queryKey: queryKeys.organizations });
      setStep("done");
      fireConfetti(true);
    } finally {
      setSaving(false);
    }
  }

  const footer = (onNext: () => void, nextLabel = `${t("common.next")} →`, onSkip?: () => void) => (
    <div className="flex justify-between gap-2 pt-4">
      <Button variant="ghost" onClick={onSkip ?? onNext} disabled={saving}>
        {t("onboarding.later")}
      </Button>
      <Button onClick={onNext} disabled={saving}>
        {nextLabel}
      </Button>
    </div>
  );

  if (step === "done") {
    return (
      <div className="space-y-6 text-center">
        <Piggy state="bang" size={120} className="mx-auto" />
        <h1 className="text-2xl font-bold">{t("onboarding.doneTitle")}</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/app/transactions" className="card-hover flex flex-col items-center gap-2 rounded-xl border bg-surface p-5">
            <PenLine className="size-6 text-primary" aria-hidden />
            <span className="font-semibold">{t("onboarding.manual")}</span>
            <span className="text-sm text-muted-foreground">{t("onboarding.manualBody")}</span>
          </Link>
          <Link href="/app/whatsapp" className="card-hover flex flex-col items-center gap-2 rounded-xl border bg-surface p-5">
            <MessageCircle className="size-6 text-success" aria-hidden />
            <span className="font-semibold">WhatsApp</span>
            <span className="text-sm text-muted-foreground">{t("onboarding.waBody")}</span>
          </Link>
        </div>
        <Button size="lg" asChild>
          <Link href="/app/dashboard">{t("onboarding.toDashboard")} →</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Piggy state="wave" size={72} message={step === 1 ? t("onboarding.hello") : step === 2 ? t("onboarding.budgetQ") : t("onboarding.paydayQ")} />
      <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
        {t("onboarding.stepOf", { step, total: 3 })}
      </p>
      <div className="rounded-xl border bg-surface p-5 shadow-sm">
        {step === 1 && (
          <>
            <h1 className="mb-3 text-lg font-semibold">{t("onboarding.categoriesTitle")}</h1>
            <p className="mb-4 text-sm text-muted-foreground">{t("onboarding.categoriesBody")}</p>
            <ul className="space-y-1">
              {allCats.map((name) => (
                <li key={name} className="flex min-h-11 items-center gap-3">
                  <Checkbox id={`cat-${name}`} checked={picked.includes(name)} onCheckedChange={() => toggle(name)} />
                  <Label htmlFor={`cat-${name}`}>{name}</Label>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (custom.trim()) setPicked((p) => [...p, custom.trim()]);
                setCustom("");
              }}
            >
              <Input aria-label={t("onboarding.addOwn")} placeholder={t("onboarding.addOwn")} value={custom} onChange={(e) => setCustom(e.target.value)} />
              <Button type="submit" variant="outline" size="icon" aria-label={t("common.add")}>
                <Plus />
              </Button>
            </form>
            {footer(() => setStep(2), undefined, () => {
              setPicked([]);
              setStep(2);
            })}
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="mb-4 text-lg font-semibold">{t("onboarding.budgetsTitle")}</h1>
            <ul className="space-y-3">
              {budgets.map((b, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <Input aria-label={t("budgets.ruleName")} className="min-w-0 flex-1" value={b.name} onChange={(e) => setBudgets(budgets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <AmountInput aria-label={t("budgets.limit")} className="w-44" value={b.limit_amount} onChange={(limit_amount) => setBudgets(budgets.map((x, j) => (j === i ? { ...x, limit_amount } : x)))} />
                  <span className="text-sm text-muted-foreground">/{t("budgets.perWeek")}</span>
                  <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => setBudgets(budgets.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-3" onClick={() => setBudgets([...budgets, { name: "", limit_amount: null }])}>
              <Plus /> {t("onboarding.addBudget")}
            </Button>
            {footer(() => setStep(3), undefined, () => {
              setBudgets([]);
              setStep(3);
            })}
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="mb-4 text-lg font-semibold">{t("onboarding.paydayTitle")}</h1>
            <RadioGroup value={payday} onValueChange={setPayday}>
              {PAYDAYS.map((d) => (
                <div key={d} className="flex min-h-11 items-center gap-3">
                  <RadioGroupItem id={`pd-${d}`} value={d} />
                  <Label htmlFor={`pd-${d}`}>{t("onboarding.dateN", { day: d })}</Label>
                </div>
              ))}
              <div className="flex min-h-11 items-center gap-3">
                <RadioGroupItem id="pd-other" value="other" />
                <Label htmlFor="pd-other">{t("onboarding.otherDate")}</Label>
                <Input aria-label={t("onboarding.otherDate")} type="number" min={1} max={31} className="w-20" value={otherDay} onFocus={() => setPayday("other")} onChange={(e) => setOtherDay(e.target.value)} />
              </div>
            </RadioGroup>
            <p className="mt-3 text-sm text-muted-foreground">💡 {t("onboarding.paydayHint")}</p>
            {footer(() => finish(), t("onboarding.finish"), () => finish(true))}
          </>
        )}
      </div>
    </div>
  );
}
