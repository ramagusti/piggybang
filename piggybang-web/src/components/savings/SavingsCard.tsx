"use client";
import { useTranslations } from "next-intl";
import { Piggy, type PiggyState } from "@/components/piggy/Piggy";
import { Progress } from "@/components/ui/progress";
import { useFormat } from "@/hooks/use-utils";
import { cn } from "@/lib/utils";
import type { SavingsCurrent } from "@/types";

export function savingsMood(s: SavingsCurrent): { state: PiggyState; key: string } {
  if (Number(s.net_savings) > 0) return { state: "celebrate", key: "savings.moodPositive" };
  if (s.trend === "improving") return { state: "thumbsup", key: "savings.moodImproving" };
  return { state: "worry", key: "savings.moodNegative" };
}

export function SavingsCard({ savings }: { savings: SavingsCurrent }) {
  const t = useTranslations();
  const f = useFormat();
  const net = Number(savings.net_savings);
  const mood = savingsMood(savings);
  return (
    <section className="space-y-4 rounded-xl border bg-surface p-5 shadow-sm" aria-labelledby="savings-title">
      <h2 id="savings-title" className="flex items-center gap-2 font-semibold">
        <Piggy state="idle" size={28} />
        {t("savings.cycleTitle", { start: f.date(savings.cycle_start), end: f.date(savings.cycle_end) })}
      </h2>
      <p className={cn("text-3xl font-extrabold tabular-nums md:text-4xl", net < 0 ? "text-danger" : "text-success")}>{f.money(net, { sign: true })}</p>
      <div className="space-y-1">
        <Progress value={Math.min(savings.progress_pct, 100)} aria-label={t("savings.progress")} className="h-2.5" />
        <p className="text-xs text-muted-foreground">{t("savings.progressHint", { pct: Math.round(savings.progress_pct) })}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("dashboard.income")}</dt>
        <dd className="text-right tabular-nums">{f.money(savings.income_total)}</dd>
        <dt className="text-muted-foreground">{t("dashboard.expense")}</dt>
        <dd className="text-right tabular-nums">{f.money(savings.expense_total)}</dd>
        <dt className="font-medium">{t("savings.difference")}</dt>
        <dd className={cn("text-right font-semibold tabular-nums", net < 0 ? "text-danger" : "text-success")}>{f.money(net, { sign: true })}</dd>
      </dl>
      <Piggy state={mood.state} size={56} message={t(mood.key)} />
    </section>
  );
}
