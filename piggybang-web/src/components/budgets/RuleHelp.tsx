"use client";
import { ChevronDown, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RuleType } from "@/types";

const LABEL = { weekly_limit: "weekly", monthly_limit: "monthly", payday: "payday" } as const;

/** Collapsible "How it works" for the current rule tab. Native <details>, no state. */
export function RuleHelp({ type, defaultOpen }: { type: RuleType; defaultOpen?: boolean }) {
  const t = useTranslations("budgets");
  const points: string[] = type === "payday" ? t.raw("how.payday") : [...t.raw(`how.${LABEL[type]}`), ...t.raw("how.match")];

  return (
    <details open={defaultOpen} className="group rounded-xl border bg-surface transition-shadow duration-200 open:shadow-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 text-sm font-medium select-none hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <Info className="size-4 shrink-0 text-primary" aria-hidden />
        {t("howTitle")} · {t(LABEL[type])}
        <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="animate-in list-disc space-y-1.5 pr-4 pb-4 pl-9 text-sm text-muted-foreground fade-in-0 slide-in-from-top-1 duration-200">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </details>
  );
}
