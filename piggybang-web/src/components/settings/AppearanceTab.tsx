"use client";
import { useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useSwitchLocale } from "@/components/layout/LanguageSwitcher";
import { Flag } from "@/components/shared/Flag";
import { Button } from "@/components/ui/button";
import { formatMoney, type NumberStyle } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.97]",
              value === o.value ? "border-primary bg-primary-bg text-primary" : "bg-surface hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AppearanceTab() {
  const t = useTranslations();
  const { theme = "system", setTheme } = useTheme();
  const locale = useLocale() as "id" | "en";
  const switchLocale = useSwitchLocale();
  const storedStyle = useUIStore((s) => s.numberStyle);
  const setNumberStyle = useUIStore((s) => s.setNumberStyle);
  const [draft, setDraft] = useState({ theme, locale, style: storedStyle });

  return (
    <div className="max-w-lg space-y-6">
      <Segmented
        label={t("settings.theme")}
        value={draft.theme}
        onChange={(v) => setDraft({ ...draft, theme: v })}
        options={[
          { value: "light", label: (<><Sun className="size-4" /> {t("settings.light")}</>) },
          { value: "dark", label: (<><Moon className="size-4" /> {t("settings.dark")}</>) },
          { value: "system", label: (<><Laptop className="size-4" /> {t("settings.system")}</>) },
        ]}
      />
      <Segmented
        label={t("settings.language")}
        value={draft.locale}
        onChange={(v) => setDraft({ ...draft, locale: v })}
        options={[
          { value: "id", label: (<><Flag locale="id" /> Indonesia</>) },
          { value: "en", label: (<><Flag locale="en" /> English</>) },
        ]}
      />
      <Segmented<NumberStyle>
        label={t("settings.numberFormat")}
        value={draft.style}
        onChange={(v) => setDraft({ ...draft, style: v })}
        options={[
          { value: "id", label: formatMoney(1234567, { style: "id" }) },
          { value: "intl", label: formatMoney(1234567, { style: "intl" }) },
        ]}
      />
      <Button
        onClick={() => {
          setTheme(draft.theme);
          setNumberStyle(draft.style);
          toast.success(t("common.saved"));
          if (draft.locale !== locale) switchLocale(draft.locale);
        }}
      >
        {t("common.save")}
      </Button>
    </div>
  );
}
