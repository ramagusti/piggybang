import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BudgetProgress, budgetLevel } from "./BudgetProgress";

describe("BudgetProgress", () => {
  it.each([
    [58000, 65000, "near", 89],
    [10000, 65000, "ok", 15],
    [385344, 282526, "exceeded", 100],
  ])("spent %i of %i → %s", (spent, limit, level, now) => {
    render(<BudgetProgress spent={spent} limit={limit} label="b" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("data-level", level);
    expect(bar).toHaveAttribute("aria-valuenow", String(now));
  });

  it("thresholds: <80 ok, 80–100 near, >100 exceeded", () => {
    expect(budgetLevel(79.9)).toBe("ok");
    expect(budgetLevel(80)).toBe("near");
    expect(budgetLevel(100)).toBe("near");
    expect(budgetLevel(100.1)).toBe("exceeded");
  });

  it("zero limit with spending counts as exceeded", () => {
    render(<BudgetProgress spent={1} limit={0} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-level", "exceeded");
  });
});
