"use client";
import { Crown, MoreVertical, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { initials } from "@/components/layout/Navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Member, Role } from "@/types";

export function MemberList({
  members,
  canManage,
  isPro,
  onRole,
  onRemove,
}: {
  members: Member[];
  canManage: boolean;
  isPro: boolean;
  onRole: (m: Member, role: Role) => void;
  onRemove: (m: Member) => void;
}) {
  const t = useTranslations();
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-surface">
      {members.map((m) => (
        <li key={m.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
          <Avatar className="size-10">
            {m.user?.avatar_url && <AvatarImage src={m.user.avatar_url} alt="" />}
            <AvatarFallback className="bg-primary-bg text-primary">{initials(m.user?.name ?? m.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{m.user?.name ?? m.email}</p>
            <p className="truncate text-sm text-muted-foreground">{m.pending ? t("team.pending") : (m.user?.email ?? m.email)}</p>
          </div>
          <Badge variant={m.role === "owner" ? "default" : "secondary"}>
            {m.role === "owner" && <Crown aria-hidden />}
            {t(`team.role_${m.role}`)}
          </Badge>
          {canManage && m.role !== "owner" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("team.changeRole")}</DropdownMenuLabel>
                {(["admin", "member", "viewer"] as const).map((r) => (
                  <DropdownMenuItem key={r} disabled={r === m.role || (r !== "member" && !isPro)} onSelect={() => onRole(m, r)}>
                    {t(`team.role_${r}`)}
                    {r !== "member" && !isPro && " (Pro)"}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onRemove(m)}>
                  <UserMinus /> {m.pending ? t("team.cancelInvite") : t("team.remove")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="size-11 md:size-8" aria-hidden />
          )}
        </li>
      ))}
    </ul>
  );
}
