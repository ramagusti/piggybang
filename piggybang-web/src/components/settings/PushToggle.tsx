"use client";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { disablePush, enablePush, pushEnabled, pushSupported } from "@/lib/push";

const KEY = ["push-enabled"];

/** Per-device switch for push notifications (daily "nothing recorded yet" nudge, bills and payday from D-3). */
export function PushToggle() {
  const t = useTranslations("settings");
  const qc = useQueryClient();
  const { data: on = false } = useQuery({ queryKey: KEY, queryFn: pushEnabled });
  const supported = pushSupported();

  async function toggle(next: boolean) {
    try {
      if (next) {
        if (!(await enablePush())) toast.error(t("pushBlocked"));
      } else await disablePush();
    } catch (err) {
      toast.error((err as Error).message);
    }
    qc.invalidateQueries({ queryKey: KEY });
  }

  return (
    <div className="max-w-lg rounded-xl border p-4">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="push-toggle" className="font-semibold">
          {t("push")}
        </Label>
        <Switch id="push-toggle" checked={on} disabled={!supported} onCheckedChange={toggle} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{supported ? t("pushHint") : t("pushUnsupported")}</p>
    </div>
  );
}
