"use client";
import { useState } from "react";
import { Check, ChevronDown, Home, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Cookies from "js-cookie";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { queryKeys, useCurrentOrg } from "@/hooks/api";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { Organization } from "@/types";

export function CreateOrgDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const qc = useQueryClient();
  const setCurrentOrg = useAuthStore((s) => s.setCurrentOrg);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const org = await api<Organization>("/organizations", { method: "POST", body: { name } });
      Cookies.remove("pb_org_slug");
      setCurrentOrg(org.id);
      await qc.invalidateQueries({ queryKey: queryKeys.organizations });
      onOpenChange(false);
      setName("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={t("org.create")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-org">{t("auth.teamName")}</Label>
          <Input id="new-org" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.teamPlaceholder")} />
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={!name}>
          {t("org.create")}
        </Button>
      </form>
    </ResponsiveModal>
  );
}

/** Hidden when the user only has one org (spec §2.1); create-new lives in the user menu then. */
export function OrgSwitcher() {
  const t = useTranslations();
  const { org, orgs } = useCurrentOrg();
  const qc = useQueryClient();
  const setCurrentOrg = useAuthStore((s) => s.setCurrentOrg);
  const [creating, setCreating] = useState(false);
  if (!org || orgs.length < 2) return null;

  function choose(o: Organization) {
    Cookies.remove("pb_org_slug");
    setCurrentOrg(o.id);
    api(`/organizations/${o.id}/switch`, { method: "POST" }).catch(() => {});
    qc.invalidateQueries({ queryKey: queryKeys.org(o.id) });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="max-w-48 gap-2" aria-label={t("org.switch")}>
            <Home aria-hidden />
            <span className="truncate">{org.name}</span>
            <ChevronDown className="opacity-60" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {orgs.map((o) => (
            <DropdownMenuItem key={o.id} onSelect={() => choose(o)} className="min-h-11">
              <span className="truncate">{o.name}</span>
              {o.id === org.id && <Check className="ml-auto" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)} className="min-h-11">
            <Plus /> {t("org.create")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateOrgDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
