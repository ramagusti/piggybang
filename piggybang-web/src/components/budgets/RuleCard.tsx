"use client";
import { BellOff, BellRing, MoreVertical, Pencil, Sparkles, Trash2, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Piggy } from "@/components/piggy/Piggy";
import { CategoryDot } from "@/components/shared/CategoryPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useFormat } from "@/hooks/use-utils";
import type { Rule } from "@/types";
import { BudgetProgress, budgetLevel } from "./BudgetProgress";

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> {t("common.edit")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> {t("common.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RuleCard({
  rule,
  canWrite,
  onEdit,
  onDelete,
  onOpen,
}: {
  rule: Rule;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpen?: () => void; // budgets: show the transactions counting toward it
}) {
  const t = useTranslations();
  const f = useFormat();

  if (rule.type === "payday") {
    return (
      <div className="card-hover rounded-xl border bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-success-light text-success-dark">
            <Wallet className="size-5" aria-hidden />
          </span>
          <div className="flex-1 space-y-1 text-sm">
            <p className="text-base font-semibold">
              {rule.name} — {t("budgets.dayOf", { day: rule.date_condition ?? "?" })}
              {rule.is_primary_payday && <Badge className="ml-2">{t("budgets.primary")}</Badge>}
            </p>
            {rule.category && (
              <p className="text-muted-foreground">
                {t("tx.category")}: <CategoryDot category={rule.category} /> {rule.category.name}
              </p>
            )}
            {rule.category_name && (
              <p className="text-muted-foreground">
                {t("budgets.keywords")}: “{rule.category_name}”
              </p>
            )}
            {rule.ai_assign && (
              <p className="flex items-center gap-1 text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" aria-hidden /> {t("budgets.aiAssigned")}
              </p>
            )}
            {rule.cycle && (
              <p>
                {t("budgets.cycle")}: {f.date(rule.cycle.start)} → {f.date(rule.cycle.end)}
              </p>
            )}
          </div>
          {canWrite && <Actions onEdit={onEdit} onDelete={onDelete} />}
        </div>
      </div>
    );
  }

  const p = rule.progress;
  const spent = Number(p?.spent ?? 0);
  const effective = Number(p?.effective_limit ?? rule.limit_amount);
  const carry = Number(p?.carryover ?? 0);
  const level = budgetLevel(p?.percent ?? (effective ? (spent / effective) * 100 : 0));

  return (
    <div
      className="card-hover space-y-3 rounded-xl border bg-surface p-5 cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
      role="button"
      tabIndex={0}
      aria-label={t("budgets.showTx", { name: rule.name })}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen?.();
        }
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="flex items-center gap-2 font-semibold">
            {rule.category && <CategoryDot category={rule.category} />} {rule.name}
            {rule.notify ? (
              <BellRing className="size-3.5 text-primary" aria-label={t("budgets.notifyOn")} />
            ) : (
              <BellOff className="size-3.5 text-muted-foreground" aria-label={t("budgets.notifyOff")} />
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("budgets.limit")}: {f.money(rule.limit_amount)} / {t(rule.type === "weekly_limit" ? "budgets.perWeek" : "budgets.perMonth")}
          </p>
          {(rule.ai_assign || rule.category_name) && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              {rule.ai_assign && <Sparkles className="size-3.5 text-primary" aria-hidden />}
              {[rule.ai_assign && t("budgets.aiAssigned"), rule.category_name && `${t("budgets.keywords")}: “${rule.category_name}”`].filter(Boolean).join(" · ")}
            </p>
          )}
          {rule.type === "weekly_limit" && (
            <p className="text-sm text-muted-foreground">
              {t("budgets.rollover")}: {rule.rollover_enabled ? t("common.active") : t("common.inactive")}
            </p>
          )}
        </div>
        {canWrite && (
          // The menu (and its portal, which still bubbles through React) must not also open the transactions list.
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Actions onEdit={onEdit} onDelete={onDelete} />
          </div>
        )}
      </div>
      <BudgetProgress spent={spent} limit={effective} label={rule.name} />
      <p className="text-sm tabular-nums">
        {f.money(spent)} {t("budgets.of")} {f.money(effective)}
      </p>
      {carry !== 0 && (
        <p className="text-sm text-muted-foreground">
          {t("budgets.effective")}: {f.money(effective)} ({carry < 0 ? t("budgets.deficit") : t("budgets.surplus")} {f.money(carry, { sign: true })})
        </p>
      )}
      {level === "exceeded" ? (
        <Piggy state="worry" size={44} message={<span className="text-danger">{t("budgets.exceededMsg", { cat: rule.name })}</span>} />
      ) : level === "near" ? (
        <Piggy state="point" size={44} message={t("budgets.nearMsg")} />
      ) : (
        <p className="text-sm text-success-dark dark:text-success">
          {t("budgets.remaining")}: {f.money(p?.remaining ?? effective - spent)}
        </p>
      )}
    </div>
  );
}
