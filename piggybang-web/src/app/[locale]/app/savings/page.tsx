"use client";
import { useEffect } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useOrg } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SavingsCard } from "@/components/savings/SavingsCard";
import { SavingsChart } from "@/components/savings/SavingsChart";
import { fireConfetti } from "@/components/shared/DelightAnimation";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSavings, useSavingsHistory } from "@/hooks/api";
import { useFormat } from "@/hooks/use-utils";
import { download } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function SavingsPage() {
  const t = useTranslations();
  const f = useFormat();
  const { org } = useOrg();
  const current = useSavings(org.id);
  const history = useSavingsHistory(org.id);
  const positive = Number(current.data?.net_savings) > 0;

  useEffect(() => {
    if (positive && !sessionStorage.getItem("pb_confetti_savings")) {
      sessionStorage.setItem("pb_confetti_savings", "1");
      fireConfetti(true);
    }
  }, [positive]);

  const exportAs = (format: "csv" | "pdf") => download(`/organizations/${org.id}/export/savings`, { format }, `savings.${format}`).catch((e) => toast.error(e.message));

  return (
    <>
      <PageHeader
        title={t("nav.savings")}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download /> {t("tx.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => exportAs("csv")}>CSV</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAs("pdf")}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {current.isLoading ? (
        <LoadingSkeleton variant="cards" count={1} />
      ) : current.error || !current.data ? (
        <ErrorState onRetry={() => current.refetch()} />
      ) : (
        <SavingsCard savings={current.data} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("savings.history")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {history.isLoading ? (
            <LoadingSkeleton variant="table" />
          ) : history.error ? (
            <ErrorState onRetry={() => history.refetch()} message={t("savings.chartError")} />
          ) : !history.data?.length ? (
            <EmptyState piggy="sleep" title={t("savings.emptyTitle")} />
          ) : (
            <>
              <SavingsChart history={history.data} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("savings.period")}</TableHead>
                    <TableHead className="text-right">{t("dashboard.income")}</TableHead>
                    <TableHead className="text-right">{t("dashboard.expense")}</TableHead>
                    <TableHead className="text-right">{t("savings.net")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.data.map((s) => (
                    <TableRow key={s.cycle_start}>
                      <TableCell className="whitespace-nowrap">
                        {f.date(s.cycle_start)} – {f.date(s.cycle_end)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{f.money(s.income_total, { compact: true })}</TableCell>
                      <TableCell className="text-right tabular-nums">{f.money(s.expense_total, { compact: true })}</TableCell>
                      <TableCell className={cn("text-right font-semibold tabular-nums", Number(s.net_savings) < 0 ? "text-danger" : "text-success")}>
                        {f.money(s.net_savings, { compact: true, sign: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
