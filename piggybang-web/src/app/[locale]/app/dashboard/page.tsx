"use client";
import { useState } from "react";
import { Calendar, CalendarDays, CalendarRange, MessageCircle, PiggyBank, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useOrg } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { BudgetProgress } from "@/components/budgets/BudgetProgress";
import { Piggy } from "@/components/piggy/Piggy";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { TransactionDialog } from "@/components/transactions/TransactionForm";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboard } from "@/hooks/api";
import { useFormat } from "@/hooks/use-utils";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Period = "week" | "month" | "year";

function Change({ pct, goodWhenUp }: { pct: number | null; goodWhenUp: boolean }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium", good ? "text-success" : "text-danger")}>
      <Icon className="size-4" aria-hidden /> {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export default function DashboardPage() {
  const t = useTranslations();
  const f = useFormat();
  const { org, can } = useOrg();
  const [period, setPeriod] = useState<Period>("month");
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading, error, refetch } = useDashboard(org.id, period);

  const header = (
    <PageHeader title={t("dashboard.title")}>
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="mt-3">
        <TabsList>
          <TabsTrigger value="week">
            <CalendarDays />
            {t("dashboard.week")}
          </TabsTrigger>
          <TabsTrigger value="month">
            <Calendar />
            {t("dashboard.month")}
          </TabsTrigger>
          <TabsTrigger value="year">
            <CalendarRange />
            {t("dashboard.year")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </PageHeader>
  );

  if (isLoading)
    return (
      <>
        {header}
        <LoadingSkeleton variant="cards" count={3} />
        <LoadingSkeleton count={5} />
      </>
    );
  if (error || !data)
    return (
      <>
        {header}
        <ErrorState onRetry={() => refetch()} />
      </>
    );

  const { kpi } = data;
  const savingsNum = Number(kpi.savings);
  const addButton = can("transactions.write") && (
    <Button size="sm" data-tour="tx-add" onClick={() => setFormOpen(true)}>
      <Plus /> {t("tx.add")}
    </Button>
  );

  if (data.transactions_total === 0) {
    return (
      <>
        {header}
        <Card data-tour="summary">
          <EmptyState
            piggy="wave"
            title={t("dashboard.emptyTitle")}
            description={t("dashboard.emptyBody")}
            action={
              <>
                {can("transactions.write") && (
                  <Button data-tour="tx-add" onClick={() => setFormOpen(true)}>
                    <Plus /> {t("tx.add")}
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href="/app/whatsapp">
                    <MessageCircle /> {t("whatsapp.connect")}
                  </Link>
                </Button>
              </>
            }
          />
        </Card>
        <TransactionDialog open={formOpen} onOpenChange={setFormOpen} />
      </>
    );
  }

  return (
    <>
      {header}

      <section className="grid gap-4 sm:grid-cols-3" aria-label={t("dashboard.summary")} data-tour="summary">
        <Card className="card-hover">
          <CardContent className="space-y-2">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <PiggyBank className="size-4" aria-hidden /> {t("dashboard.savings")}
            </p>
            <p className={cn("text-2xl font-bold tabular-nums", savingsNum < 0 ? "text-danger" : "text-success")}>{f.money(kpi.savings, { compact: true })}</p>
            <Progress value={Math.min(kpi.savings_progress_pct, 100)} aria-label={t("savings.progress")} />
            <p className="text-xs text-muted-foreground">{t("savings.progressHint", { pct: Math.round(kpi.savings_progress_pct) })}</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="space-y-2">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2.5 rounded-full bg-success" aria-hidden /> {t("dashboard.income")}
            </p>
            <p className="text-2xl font-bold tabular-nums">{f.money(kpi.income, { compact: true })}</p>
            <Change pct={kpi.income_change_pct} goodWhenUp />
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="space-y-2">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2.5 rounded-full bg-danger" aria-hidden /> {t("dashboard.expense")}
            </p>
            <p className="text-2xl font-bold tabular-nums">{f.money(kpi.expense, { compact: true })}</p>
            <Change pct={kpi.expense_change_pct} goodWhenUp={false} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.recentTransactions")}</CardTitle>
          <CardAction>{addButton}</CardAction>
        </CardHeader>
        <CardContent>
          <ul className="divide-y" aria-live="polite">
            {data.recent_transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </ul>
          <div className="mt-3 flex justify-end">
            <Button variant="link" asChild>
              <Link href="/app/transactions">{t("common.viewAll")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.budgetWarnings")}</CardTitle>
            <CardAction>
              <Button variant="link" size="sm" asChild>
                <Link href="/app/budgets">{t("dashboard.manage")}</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.budget_warnings.length === 0 ? (
              <div className="flex items-center gap-3">
                <Piggy state="thumbsup" size={56} />
                <p className="text-sm text-muted-foreground">{t("dashboard.noWarnings")}</p>
              </div>
            ) : (
              <>
                <Piggy state="worry" size={48} message={t("dashboard.careful")} />
                <ul className="mt-3 space-y-3">
                  {data.budget_warnings.map((w) => (
                    <li key={w.rule_id} className="space-y-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium">{w.name}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {f.money(w.spent)} / {f.money(w.effective_limit)}
                        </span>
                      </div>
                      <BudgetProgress spent={Number(w.spent)} limit={Number(w.effective_limit)} label={w.name} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.upcomingBills")}</CardTitle>
            <CardAction>
              <Button variant="link" size="sm" asChild>
                <Link href="/app/bills">{t("common.viewAll")}</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.upcoming_bills.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("bills.noneUpcoming")}</p>
            ) : (
              <ul className="space-y-2">
                {data.upcoming_bills.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-right">
                      <span className="block tabular-nums">{f.money(b.amount, { currency: b.currency })}</span>
                      <span className={cn("text-xs", b.days_until_due <= 3 ? "text-danger" : "text-muted-foreground")}>
                        {t("bills.inDays", { days: b.days_until_due })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {data.expense_by_category.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.expenseByCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: Math.max(160, data.expense_by_category.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.expense_by_category.map((c) => ({ ...c, total: Number(c.total) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    formatter={(v) => f.money(Number(v))}
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}
                  />
                  <Bar dataKey="total" radius={[0, 8, 8, 0]} name={t("dashboard.expense")}>
                    {data.expense_by_category.map((c, i) => (
                      <Cell key={c.category_id} fill={c.color ?? `var(--chart-${(i % 5) + 1})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <TransactionDialog open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
