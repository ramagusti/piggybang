"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryKeys } from "@/hooks/api";
import { api } from "@/lib/api";
import type { User } from "@/types";

export function ProfileTab({ user }: { user: User }) {
  const t = useTranslations();
  const qc = useQueryClient();
  const [v, setV] = useState({ name: user.name, timezone: user.timezone, avatar_url: user.avatar_url ?? "" });
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="max-w-lg space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await api("/user", { method: "PATCH", body: { ...v, avatar_url: v.avatar_url || null } });
          await qc.invalidateQueries({ queryKey: queryKeys.me });
          toast.success(t("common.saved"));
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="p-name">{t("auth.fullName")}</Label>
        <Input id="p-name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-email">{t("auth.email")}</Label>
        <Input id="p-email" value={user.email} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-tz">{t("settings.timezone")}</Label>
        <Input id="p-tz" list="tz-list" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} />
        <datalist id="tz-list">
          {["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "UTC"].map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-avatar">{t("settings.avatarUrl")}</Label>
        <Input id="p-avatar" type="url" value={v.avatar_url} onChange={(e) => setV({ ...v, avatar_url: e.target.value })} />
      </div>
      <Button type="submit" disabled={saving}>
        {t("common.save")}
      </Button>
    </form>
  );
}
