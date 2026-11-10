"use client";
import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFormat } from "@/hooks/use-utils";
import type { Savings } from "@/types";

/** Net savings per payday cycle (oldest → newest). */
export function SavingsChart({ history }: { history: Savings[] }) {
  const t = useTranslations();
  const f = useFormat();
  const data = [...history].reverse().map((s) => ({ label: f.date(s.cycle_start), net: Number(s.net_savings) }));
  return (
    <div className="h-64" role="img" aria-label={t("savings.chartLabel")}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => f.money(v, { compact: true })} width={90} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="var(--text-tertiary)" />
          <Tooltip formatter={(v) => f.money(Number(v), { sign: true })} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} />
          <Area type="monotone" dataKey="net" name={t("savings.net")} stroke="var(--primary)" strokeWidth={2} fill="url(#netFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
