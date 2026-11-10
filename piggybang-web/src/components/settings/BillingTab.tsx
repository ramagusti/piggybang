"use client";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { PlanComparison } from "@/components/settings/PlanComparison";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useOrgMutation, useSubscription } from "@/hooks/api";
import { useFormat } from "@/hooks/use-utils";
import { api } from "@/lib/api";
import {
  BOT_PACK,
  ADDON_INVOICE_MIN,
  PAYMENT_METHODS,
  SEAT,
  TIERS,
  type TierKey,
  yearlySaving,
} from "@/lib/plans";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Organization, Subscription } from "@/types";

interface CheckoutVars {
  tier: TierKey;
  interval: "monthly" | "yearly";
  extra_seats: number;
  bot_packs: number;
}

/** Small − n + stepper for add-on quantities. */
function Stepper({
  id,
  value,
  onChange,
  max = 100,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <div className="inline-flex h-11 items-center overflow-hidden rounded-lg border">
      <button
        type="button"
        aria-label="−"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-full w-11 text-lg transition-colors hover:bg-muted active:scale-95"
      >
        −
      </button>
      <input
        id={id}
        inputMode="numeric"
        className="h-full w-14 border-x bg-transparent text-center tabular-nums outline-none"
        value={value}
        onChange={(e) =>
          onChange(
            Math.min(
              max,
              Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0),
            ),
          )
        }
      />
      <button
        type="button"
        aria-label="+"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-full w-11 text-lg transition-colors hover:bg-muted active:scale-95"
      >
        +
      </button>
    </div>
  );
}

function CheckoutDialog({
  orgId,
  sub,
  open,
  onOpenChange,
}: {
  orgId: number;
  sub?: Subscription;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations();
  const f = useFormat();
  const [openedAt] = useState(() => Date.now()); // estimate reference, fixed while the dialog is open
  const [v, setV] = useState<CheckoutVars>({
    tier: sub?.tier && sub.tier !== "trial" ? sub.tier : "pro",
    interval: sub?.interval ?? "yearly", // new subscriptions default to yearly: one payment fee per year
    extra_seats: sub?.extra_seats ?? 0,
    bot_packs: sub?.bot_packs ?? 0,
  });
  const checkout = useOrgMutation(orgId, () =>
    api<{ url: string | null }>(
      `/organizations/${orgId}/subscription/checkout`,
      {
        method: "POST",
        body: {
          plan: "pro",
          tier: v.tier,
          interval: v.interval,
          extra_seats: v.extra_seats,
          bot_packs: v.bot_packs,
          provider: "xendit",
        },
      },
    ),
  );
  const tier = TIERS.find((x) => x.key === v.tier)!;
  const addons = (
    seats: number,
    packs: number,
    interval: CheckoutVars["interval"],
  ) => seats * SEAT[interval] + packs * BOT_PACK[interval];
  const total =
    tier[v.interval] + addons(v.extra_seats, v.bot_packs, v.interval);
  const replies =
    tier.botReplies +
    v.extra_seats * SEAT.botReplies +
    v.bot_packs * BOT_PACK.replies;
  // Same tier + interval on a live plan → only add-ons change: applied now, pro rata for the days left (mirrors BillingService::changeAddons).
  const addonOnly =
    !!sub &&
    sub.status === "active" &&
    sub.provider === "xendit" &&
    sub.tier === v.tier &&
    sub.interval === v.interval &&
    !!sub.current_period_end;
  const diff = addonOnly
    ? addons(v.extra_seats, v.bot_packs, v.interval) -
      addons(sub.extra_seats, sub.bot_packs, v.interval)
    : 0;
  const end = sub?.current_period_end
    ? new Date(sub.current_period_end).getTime()
    : 0;
  const start = sub?.current_period_start
    ? new Date(sub.current_period_start).getTime()
    : 0;
  const prorated =
    diff > 0
      ? Math.round(
          (diff * Math.max(0, end - openedAt)) / Math.max(1, end - start) / 100,
        ) * 100
      : 0;
  // Mirrors BillingService::changeAddons: small increases ride on the next invoice instead of their own.
  const deferred =
    diff > 0 && prorated < ADDON_INVOICE_MIN && !sub?.cancel_at_period_end;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t("billing.checkoutTitle")}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const { url } = await checkout.mutateAsync();
          if (url) window.location.href = url;
          else {
            toast.success(t("billing.addonApplied"));
            onOpenChange(false);
          }
        }}
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            {t("billing.choosePlan")}
          </legend>
          <div className="grid gap-2" role="radiogroup">
            {TIERS.map((x) => (
              <button
                key={x.key}
                type="button"
                role="radio"
                aria-checked={v.tier === x.key}
                onClick={() => setV({ ...v, tier: x.key })}
                className={cn(
                  "flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 text-left transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.99]",
                  v.tier === x.key
                    ? "border-primary bg-primary-bg"
                    : "bg-surface hover:bg-muted",
                )}
              >
                <span>
                  <span className="block font-semibold">{x.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("billing.botReplies", { count: x.botReplies })}
                  </span>
                </span>
                <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
                  {f.money(x.monthly)}
                  <span className="font-normal text-muted-foreground">
                    /{t("billing.month")}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("billing.reactionsFree")}
          </p>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            {t("billing.interval")}
          </legend>
          <RadioGroup
            value={v.interval}
            onValueChange={(interval) =>
              setV({ ...v, interval: interval as CheckoutVars["interval"] })
            }
          >
            <label
              htmlFor="int-y"
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors duration-200",
                v.interval === "yearly"
                  ? "border-primary bg-primary-bg"
                  : "bg-surface hover:bg-muted",
              )}
            >
              <RadioGroupItem id="int-y" value="yearly" />
              <span className="flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {t("billing.yearly")} · {f.money(tier.yearly)}
                  <Badge className="bg-success text-white">
                    {t("billing.save", { pct: yearlySaving(tier) })}
                  </Badge>
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("billing.yearlyPerMonth", {
                    amount: f.money(Math.round(tier.yearly / 12)),
                  })}
                </span>
              </span>
            </label>
            <label
              htmlFor="int-m"
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 transition-colors duration-200",
                v.interval === "monthly"
                  ? "border-primary bg-primary-bg"
                  : "bg-surface hover:bg-muted",
              )}
            >
              <RadioGroupItem id="int-m" value="monthly" />
              <span className="font-medium">
                {t("billing.monthly")} · {f.money(tier.monthly)}
              </span>
            </label>
          </RadioGroup>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="seats">{t("billing.extraSeats")}</Label>
          <Stepper
            id="seats"
            value={v.extra_seats}
            onChange={(extra_seats) => setV({ ...v, extra_seats })}
          />
          <p className="text-xs text-muted-foreground">
            {t("billing.seatHint", {
              price: f.money(SEAT.monthly),
              replies: SEAT.botReplies,
            })}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="packs">{t("billing.botPacks")}</Label>
          <Stepper
            id="packs"
            value={v.bot_packs}
            onChange={(bot_packs) => setV({ ...v, bot_packs })}
          />
          <p className="text-xs text-muted-foreground">
            {t("billing.packHint", {
              price: f.money(BOT_PACK.monthly),
              replies: BOT_PACK.replies,
            })}
          </p>
        </div>
        <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
          <p>
            {t("billing.total")}: <strong>{f.money(total)}</strong> /{" "}
            {t(v.interval === "yearly" ? "billing.year" : "billing.month")} ·{" "}
            {t("billing.botReplies", { count: replies })}
          </p>
          {addonOnly && (
            <p className="text-muted-foreground">
              {diff > 0
                ? t(
                    deferred
                      ? "billing.addonNextInvoice"
                      : "billing.payNowProrated",
                    { amount: f.money(prorated) },
                  )
                : diff < 0
                  ? t("billing.reduceNow")
                  : t("billing.noChange")}
            </p>
          )}
          {!addonOnly && sub?.status === "active" && (
            <p className="text-muted-foreground">{t("billing.newPeriod")}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("billing.methods", { methods: PAYMENT_METHODS })}
          </p>
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={checkout.isPending || (addonOnly && diff === 0)}
        >
          {addonOnly && (diff <= 0 || deferred)
            ? t("billing.applyChanges")
            : t("billing.continueToPayment")}
        </Button>
      </form>
    </ResponsiveModal>
  );
}

export function BillingTab({ org }: { org: Organization }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: sub, isLoading, error, refetch } = useSubscription(org.id);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const portal = useOrgMutation(org.id, () =>
    api<{ url: string | null }>(
      `/organizations/${org.id}/subscription/portal`,
      { method: "POST" },
    ),
  );
  const cancel = useOrgMutation(org.id, () =>
    api(`/organizations/${org.id}/subscription/cancel`, { method: "POST" }),
  );

  if (isLoading) return <LoadingSkeleton variant="list" />;
  if (error || !sub) return <ErrorState onRetry={() => refetch()} />;

  const paying = sub.plan === "pro" && sub.status === "active"; // has a live subscription (manage / cancel)
  const onPaidPlan = org.plan === "pro"; // paid tier, with or without a provider subscription
  const currentTier =
    sub.effective_plan !== "pro"
      ? "free"
      : sub.tier && sub.tier !== "trial"
        ? sub.tier
        : "pro";
  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-xl border bg-surface p-5">
        <p className="text-sm text-muted-foreground">
          {t("billing.currentPlan")}
        </p>
        <p className="text-2xl font-bold">
          {sub.effective_plan !== "pro"
            ? "Free"
            : (TIERS.find((x) => x.key === sub.tier)?.name ?? "Pro")}
          {org.is_trialing && (
            <Badge className="ml-2">{t("billing.trial")}</Badge>
          )}
          {sub.cancel_at_period_end && (
            <Badge variant="destructive" className="ml-2">
              {t("billing.cancelling")}
            </Badge>
          )}
        </p>
        {sub.plan === "pro" && (
          <>
            <p className="text-sm">
              {t("billing.membersIncluded", { count: 5 })}
            </p>
            {sub.extra_seats > 0 && (
              <p className="text-sm">
                {t("team.extraSeats", {
                  count: sub.extra_seats,
                  price: f.money(sub.extra_seats * SEAT.monthly),
                })}
              </p>
            )}
            {sub.deferred_addon_total > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("billing.deferredLine", {
                  amount: f.money(sub.deferred_addon_total),
                })}
              </p>
            )}
            {sub.bot_packs > 0 && (
              <p className="text-sm">
                {t("billing.packsLine", {
                  count: sub.bot_packs,
                  replies: sub.bot_packs * BOT_PACK.replies,
                  price: f.money(sub.bot_packs * BOT_PACK.monthly),
                })}
              </p>
            )}
            <p className="font-semibold">
              {t("billing.total")}: {f.money(sub.monthly_total)}/
              {t("billing.month")}
            </p>
          </>
        )}
        {sub.current_period_start && sub.current_period_end && (
          <p className="text-sm text-muted-foreground">
            {t("billing.period")}: {f.date(sub.current_period_start)} –{" "}
            {f.date(sub.current_period_end)}
          </p>
        )}
        {org.is_trialing && org.trial_ends_at && (
          <p className="text-sm text-muted-foreground">
            {t("billing.trialUntil", { date: f.date(org.trial_ends_at) })}
          </p>
        )}
        {sub.bot_quota > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-sm">
              {t("billing.botUsage", {
                used: sub.bot_used,
                quota: sub.bot_quota,
              })}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{
                  width: `${Math.min(100, (sub.bot_used / sub.bot_quota) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={() => setCheckoutOpen(true)}>
            {onPaidPlan ? t("billing.changePlan") : t("billing.upgrade")}
          </Button>
          {paying && (
            <Button variant="outline" onClick={() => setCheckoutOpen(true)}>
              {t("billing.manageAddons")}
            </Button>
          )}
          {paying && (
            <Button
              variant="outline"
              disabled={portal.isPending}
              onClick={async () => {
                const { url } = await portal.mutateAsync();
                if (url) window.location.href = url;
              }}
            >
              <ExternalLink /> {t("billing.managePayment")}
            </Button>
          )}
          {paying && !sub.cancel_at_period_end && (
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              {t("billing.cancel")}
            </Button>
          )}
        </div>
      </section>

      <PlanComparison current={currentTier} />

      <section className="space-y-3">
        <h2 className="font-semibold">{t("billing.history")}</h2>
        {sub.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("billing.noInvoices")}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-surface">
            {sub.invoices.map((inv, i) => (
              <li
                key={i}
                className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {f.date(inv.date)}
                </span>
                <span className="flex-1">{inv.description}</span>
                <span className="font-medium tabular-nums">
                  {f.money(inv.amount)}
                </span>
                <Badge
                  variant={inv.status === "paid" ? "secondary" : "outline"}
                >
                  {inv.status}
                </Badge>
                {inv.url && (
                  <a
                    href={inv.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {t("billing.view")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {checkoutOpen && (
        <CheckoutDialog
          orgId={org.id}
          sub={sub}
          open
          onOpenChange={setCheckoutOpen}
        />
      )}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t("billing.cancelConfirm")}
        description={t("billing.cancelHint")}
        confirmLabel={t("billing.cancel")}
        loading={cancel.isPending}
        onConfirm={async () => {
          await cancel.mutateAsync();
          setCancelOpen(false);
        }}
      />
    </div>
  );
}
