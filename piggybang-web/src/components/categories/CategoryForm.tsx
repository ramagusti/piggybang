"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrgMutation } from "@/hooks/api";
import { api } from "@/lib/api";
import type { Category, TxType } from "@/types";
import { CategoryColorPicker } from "./CategoryColorPicker";

export function CategoryForm({
  orgId,
  type,
  category,
  open,
  onOpenChange,
}: {
  orgId: number;
  type: TxType;
  category?: Category;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations();
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [color, setColor] = useState<string | null>(category?.color ?? null);
  const save = useOrgMutation(orgId, () =>
    api(category ? `/organizations/${orgId}/categories/${category.id}` : `/organizations/${orgId}/categories`, {
      method: category ? "PATCH" : "POST",
      body: { type, name, icon: icon || null, color },
    }),
  );

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={category ? t("category.edit") : t("category.new")}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await save.mutateAsync();
          onOpenChange(false);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="cat-name">{t("category.name")}</Label>
          <Input id="cat-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat-icon">{t("category.icon")}</Label>
          <Input id="cat-icon" maxLength={8} className="w-24" placeholder="🍜" value={icon} onChange={(e) => setIcon(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t("category.color")}</span>
          <CategoryColorPicker value={color} onChange={setColor} />
        </div>
        <Button type="submit" className="w-full" disabled={!name || save.isPending}>
          {t("common.save")}
        </Button>
      </form>
    </ResponsiveModal>
  );
}
