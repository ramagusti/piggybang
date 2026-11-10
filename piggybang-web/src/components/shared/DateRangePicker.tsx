"use client";
import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

/** Two native date inputs — the platform picker is accessible and mobile-friendly. */
export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (range: { from?: string; to?: string }) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-2">
      <CalendarDays
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="date"
        aria-label={t("filters.from")}
        value={from ?? ""}
        max={to}
        onChange={(e) => onChange({ from: e.target.value || undefined, to })}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        type="date"
        aria-label={t("filters.to")}
        value={to ?? ""}
        min={from}
        onChange={(e) => onChange({ from, to: e.target.value || undefined })}
      />
    </div>
  );
}
