"use client";
import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useOrgMutation } from "@/hooks/api";
import { api } from "@/lib/api";
import type { Role } from "@/types";

export function InviteDialog({ orgId, isPro, open, onOpenChange }: { orgId: number; isPro: boolean; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "owner">>("member");
  const invite = useOrgMutation(orgId, () => api(`/organizations/${orgId}/invite`, { method: "POST", body: { email, role } }));

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={t("team.inviteTitle")}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await invite.mutateAsync();
          setEmail("");
          onOpenChange(false);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">{t("auth.email")}</Label>
          <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("team.role")}</legend>
          <RadioGroup value={role} onValueChange={(v) => setRole(v as typeof role)} className="flex flex-wrap gap-4">
            {(["admin", "member", "viewer"] as const).map((r) => {
              const locked = r !== "member" && !isPro;
              return (
                <div key={r} className="flex min-h-11 items-center gap-2">
                  <RadioGroupItem id={`role-${r}`} value={r} disabled={locked} />
                  <Label htmlFor={`role-${r}`} className={locked ? "opacity-50" : ""}>
                    {t(`team.role_${r}`)}
                    {locked && " (Pro)"}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </fieldset>
        <Button type="submit" className="w-full" disabled={!email || invite.isPending}>
          {t("team.sendInvite")}
        </Button>
        <p className="flex gap-2 text-sm text-muted-foreground">
          <Lightbulb className="size-4 shrink-0" aria-hidden /> {t("team.inviteHint")}
        </p>
      </form>
    </ResponsiveModal>
  );
}
