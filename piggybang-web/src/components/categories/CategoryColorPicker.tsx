"use client";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const CATEGORY_COLORS = ["#4F46E5", "#818CF8", "#10B981", "#F97316", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6", "#06B6D4", "#6B7280"];

export function CategoryColorPicker({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("category.color")}>
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn("size-11 rounded-full border-4 border-transparent transition-transform hover:scale-105", value === c && "border-foreground/30")}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}
