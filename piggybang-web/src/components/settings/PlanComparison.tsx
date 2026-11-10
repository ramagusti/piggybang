"use client";
import { Check, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/hooks/use-utils";
import { FEATURES } from "@/lib/features";
import { BOT_PACK, SEAT, TIERS, yearlySaving } from "@/lib/plans";
import { cn } from "@/lib/utils";

type Cell = string | boolean;
const COLS = ["free", ...TIERS.map((x) => x.key)] as const;

/** Free vs paid tiers, current plan highlighted. Mirrors the backend gates (isPro checks, tiers in config/billing.php). */
export function PlanComparison({
  current,
}: {
  current: (typeof COLS)[number];
}) {
  const t = useTranslations("billing.compare");
  const f = useFormat();
  const paid = (v: Cell): Cell[] => [false, v, v, v];
  const rows: [string, Cell[]][] = [
    ["price", ["Rp 0", ...TIERS.map((x) => f.money(x.monthly))]],
    [
      "priceYearly",
      [
        "Rp 0",
        ...TIERS.map((x) =>
          t("yearlyCell", { price: f.money(x.yearly), pct: yearlySaving(x) }),
        ),
      ],
    ],
    ["members", ["2", "5", "5", "5"]],
    [
      "extraSeat",
      [
        false,
        ...TIERS.map(() =>
          t("seat", { price: f.money(SEAT.monthly), replies: SEAT.botReplies }),
        ),
      ],
    ],
    ["whatsapp", paid(true)],
    ["logging", [false, t("unlimited"), t("unlimited"), t("unlimited")]],
    ["botReplies", [false, ...TIERS.map((x) => String(x.botReplies))]],
    [
      "botPack",
      [
        false,
        ...TIERS.map(() =>
          t("pack", {
            price: f.money(BOT_PACK.monthly),
            replies: BOT_PACK.replies,
          }),
        ),
      ],
    ],
    ["categories", ["15", t("unlimited"), t("unlimited"), t("unlimited")]],
    ["roles", paid(true)],
    ["rollover", paid(true)],
    ["currencies", paid(true)],
    ...(FEATURES.apiTokens || FEATURES.webhooks
      ? ([["api", paid(true)]] as [string, Cell[]][])
      : []),
    ["export", [true, true, true, true]],
    ["receipts", [true, true, true, true]],
  ];
  const head = ["Free", ...TIERS.map((x) => x.name)];

  return (
    <section className="space-y-3" aria-labelledby="compare-title">
      <h2 id="compare-title" className="font-semibold">
        {t("title")}
      </h2>
      <div className="overflow-x-auto rounded-xl border bg-surface">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b">
              <th className="sticky left-0 z-10 bg-surface p-3 text-left font-medium text-muted-foreground">
                <span className="sr-only">{t("feature")}</span>
              </th>
              {head.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    "p-3 text-center font-semibold",
                    COLS[i] === current && "bg-primary-bg text-primary",
                  )}
                >
                  {h}
                  {COLS[i] === current && (
                    <span className="block text-[11px] font-medium">
                      {t("yours")}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, cells]) => (
              <tr key={key} className="border-b last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface p-3 text-left font-normal text-muted-foreground shadow-[1px_0_0_var(--border)]"
                >
                  {t(key)}
                </th>
                {cells.map((c, i) => (
                  <td
                    key={i}
                    className={cn(
                      "p-3 text-center tabular-nums",
                      COLS[i] === current && "bg-primary-bg/60",
                    )}
                  >
                    {c === true ? (
                      <Check
                        className="mx-auto size-4 text-success"
                        aria-label={t("yes")}
                      />
                    ) : c === false ? (
                      <Minus
                        className="mx-auto size-4 text-muted-foreground/50"
                        aria-label={t("no")}
                      />
                    ) : (
                      c
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}
