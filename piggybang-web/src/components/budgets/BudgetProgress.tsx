import { cn } from "@/lib/utils";

export type BudgetLevel = "ok" | "near" | "exceeded";

export function budgetLevel(percent: number): BudgetLevel {
  return percent > 100 ? "exceeded" : percent >= 80 ? "near" : "ok";
}

const BAR: Record<BudgetLevel, string> = { ok: "bg-primary", near: "bg-warning", exceeded: "bg-danger" };

/** <80% indigo, 80–100% amber, >100% red (spec §3.8). */
export function BudgetProgress({ spent, limit, label, className }: { spent: number; limit: number; label?: string; className?: string }) {
  const percent = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 101 : 0;
  const level = budgetLevel(percent);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(percent, 100))}
      data-level={level}
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("h-full rounded-full transition-all duration-500", BAR[level])} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}
