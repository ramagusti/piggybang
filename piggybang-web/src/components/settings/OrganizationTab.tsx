"use client";
import { useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryKeys, useApiTokens, useOrgMutation } from "@/hooks/api";
import { FEATURES } from "@/lib/features";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { Organization } from "@/types";

function ApiTokens({ orgId }: { orgId: number }) {
  const t = useTranslations();
  const { data = [] } = useApiTokens(orgId, true);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const create = useOrgMutation(orgId, () =>
    api<{ token: string }>(`/organizations/${orgId}/api-tokens`, {
      method: "POST",
      body: { name },
    }),
  );
  const revoke = useOrgMutation(orgId, (id: number) =>
    api(`/organizations/${orgId}/api-tokens/${id}`, { method: "DELETE" }),
  );

  return (
    <section
      className="space-y-3 rounded-xl border bg-surface p-5"
      aria-labelledby="api-tokens"
    >
      <h2 id="api-tokens" className="flex items-center gap-2 font-semibold">
        <KeyRound className="size-4" aria-hidden /> {t("settings.apiTokens")}
      </h2>
      {created && (
        <div
          role="status"
          className="space-y-2 rounded-lg bg-success-light p-3 text-sm"
        >
          <p>{t("settings.tokenOnce")}</p>
          <div className="flex gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-surface p-2 text-xs">
              {created}
            </code>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={t("common.copy")}
              onClick={() =>
                navigator.clipboard
                  .writeText(created)
                  .then(() => toast.success(t("common.copied")))
              }
            >
              <Copy />
            </Button>
          </div>
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setCreated((await create.mutateAsync()).token);
          setName("");
        }}
      >
        <Input
          aria-label={t("settings.tokenName")}
          placeholder={t("settings.tokenName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={!name || create.isPending}>
          {t("settings.createToken")}
        </Button>
      </form>
      <ul className="divide-y">
        {data.map((tok) => (
          <li
            key={tok.id}
            className="flex min-h-12 items-center justify-between gap-2 text-sm"
          >
            <span>{tok.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => revoke.mutate(tok.id)}
            >
              {t("settings.revoke")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OrganizationTab({
  org,
  isPro,
}: {
  org: Organization;
  isPro: boolean;
}) {
  const t = useTranslations();
  const qc = useQueryClient();
  const router = useRouter();
  const setCurrentOrg = useAuthStore((s) => s.setCurrentOrg);
  const canEdit = org.permissions.includes("members.manage");
  const [v, setV] = useState({
    name: org.name,
    slug: org.slug,
    timezone: org.settings.timezone ?? "Asia/Jakarta",
    currency: org.settings.currency ?? "IDR",
    date_format: org.settings.date_format ?? "d MMM yyyy",
    webhook_url: org.settings.webhook_url ?? "",
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const save = useOrgMutation(org.id, () =>
    api(`/organizations/${org.id}`, {
      method: "PATCH",
      body: {
        name: v.name,
        ...(FEATURES.subdomains ? { slug: v.slug } : {}),
        settings: {
          timezone: v.timezone,
          currency: v.currency,
          date_format: v.date_format,
          ...(FEATURES.webhooks && isPro
            ? { webhook_url: v.webhook_url || null }
            : {}),
        },
      },
    }),
  );

  return (
    <div className="max-w-2xl space-y-6">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await save.mutateAsync();
          toast.success(t("common.saved"));
        }}
      >
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="o-name">{t("auth.teamName")}</Label>
            <Input
              id="o-name"
              required
              maxLength={255}
              value={v.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
            />
          </div>
          {FEATURES.subdomains && (
            <div className="space-y-1.5">
              <Label htmlFor="o-slug">{t("settings.slug")}</Label>
              <div className="flex">
                <Input
                  id="o-slug"
                  className="rounded-r-none"
                  pattern="[a-z0-9-]+"
                  value={v.slug}
                  onChange={(e) =>
                    setV({ ...v, slug: e.target.value.toLowerCase() })
                  }
                />
                <span className="grid place-items-center rounded-r-lg border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                  .piggybang.app
                </span>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-tz">{t("settings.timezone")}</Label>
              <Input
                id="o-tz"
                value={v.timezone}
                onChange={(e) => setV({ ...v, timezone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-cur">{t("tx.currency")}</Label>
              <Input
                id="o-cur"
                maxLength={3}
                disabled={!isPro}
                value={v.currency}
                onChange={(e) =>
                  setV({ ...v, currency: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-df">{t("settings.dateFormat")}</Label>
              <Input
                id="o-df"
                value={v.date_format}
                onChange={(e) => setV({ ...v, date_format: e.target.value })}
              />
            </div>
          </div>
          {FEATURES.webhooks && isPro && (
            <div className="space-y-1.5">
              <Label htmlFor="o-hook">{t("settings.webhookUrl")}</Label>
              <Input
                id="o-hook"
                type="url"
                placeholder="https://"
                value={v.webhook_url}
                onChange={(e) => setV({ ...v, webhook_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.webhookHint")}
              </p>
            </div>
          )}
          {canEdit && (
            <Button type="submit" disabled={save.isPending}>
              {t("common.save")}
            </Button>
          )}
        </fieldset>
      </form>

      {FEATURES.apiTokens && isPro && canEdit && <ApiTokens orgId={org.id} />}

      {org.permissions.includes("organization.delete") && (
        <section className="space-y-2 rounded-xl border border-danger/50 p-5">
          <h2 className="font-semibold text-danger">
            {t("settings.dangerZone")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("settings.deleteOrgHint")}
          </p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> {t("settings.deleteOrg")}
          </Button>
        </section>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("settings.deleteOrg")}
        description={t("settings.deleteOrgConfirm", { name: org.name })}
        loading={confirmName !== org.name}
        onConfirm={async () => {
          await api(`/organizations/${org.id}`, { method: "DELETE" });
          setCurrentOrg(null);
          await qc.invalidateQueries({ queryKey: queryKeys.organizations });
          router.replace("/app/dashboard");
        }}
      >
        <Input
          aria-label={t("settings.typeName")}
          placeholder={org.name}
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}
