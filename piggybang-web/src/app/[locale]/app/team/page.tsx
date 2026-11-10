"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOrg } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { InviteDialog } from "@/components/team/InviteDialog";
import { MemberList } from "@/components/team/MemberList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMembers, useOrgMutation } from "@/hooks/api";
import { useFormat } from "@/hooks/use-utils";
import { api } from "@/lib/api";
import type { Member, Role } from "@/types";

const PRO_INCLUDED_SEATS = 5;
const SEAT_PRICE = 30000;

export default function TeamPage() {
  const t = useTranslations();
  const f = useFormat();
  const { org, can, isPro } = useOrg();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const { data = [], isLoading, error, refetch } = useMembers(org.id);
  const canManage = can("members.manage");
  const atLimit = org.usage.members >= org.limits.members;
  const extraSeats = isPro ? Math.max(0, org.limits.members - PRO_INCLUDED_SEATS) : 0;
  const base = `/organizations/${org.id}/members`;
  // Active members by user id; pending invites by membership id + ?pending=1 (the two id spaces can collide).
  const memberPath = (b: string, m: Member) => (m.user ? `${b}/${m.user.id}` : `${b}/${m.id}?pending=1`);
  const setRole = useOrgMutation(org.id, ({ m, role }: { m: Member; role: Role }) => api(memberPath(base, m), { method: "PATCH", body: { role } }));
  const remove = useOrgMutation(org.id, (m: Member) => api(memberPath(base, m), { method: "DELETE" }));

  const invite = canManage && (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={atLimit ? 0 : -1}>
          <Button disabled={atLimit} onClick={() => setInviteOpen(true)}>
            <UserPlus /> {t("team.invite")}
          </Button>
        </span>
      </TooltipTrigger>
      {atLimit && <TooltipContent>{t("billing.upgradeToPro")}</TooltipContent>}
    </Tooltip>
  );

  return (
    <>
      <PageHeader title={t("nav.team")} actions={invite}>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant={atLimit ? "destructive" : "secondary"}>
            {org.effective_plan.toUpperCase()} · {t("team.usage", { used: org.usage.members, limit: org.limits.members })}
          </Badge>
          {extraSeats > 0 && <Badge variant="outline">{t("team.extraSeats", { count: extraSeats, price: f.money(extraSeats * SEAT_PRICE) })}</Badge>}
        </div>
      </PageHeader>
      {isLoading ? (
        <LoadingSkeleton count={3} />
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.length <= 1 && !canManage ? (
        <EmptyState piggy="wave" title={t("team.onlyYou")} />
      ) : (
        <>
          <MemberList members={data} canManage={canManage} isPro={isPro} onRole={(m, role) => setRole.mutate({ m, role })} onRemove={setRemoving} />
          {data.length <= 1 && <EmptyState piggy="point" title={t("team.onlyYou")} description={t("team.onlyYouBody")} action={invite} />}
        </>
      )}
      <InviteDialog orgId={org.id} isPro={isPro} open={inviteOpen} onOpenChange={setInviteOpen} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t("team.removeConfirm", { name: removing?.user?.name ?? removing?.email ?? "" })}
        loading={remove.isPending}
        onConfirm={async () => {
          if (removing) await remove.mutateAsync(removing);
          setRemoving(null);
        }}
      />
    </>
  );
}
