import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderUI } from "@/test/render";
import type { SavingsCurrent } from "@/types";
import { SavingsCard } from "./SavingsCard";

const base: SavingsCurrent = {
  cycle_start: "2026-07-24",
  cycle_end: "2026-08-23",
  income_total: "16000000.00",
  expense_total: "105491625.00",
  net_savings: "-89491625.00",
  previous_net: "-79200000.00",
  trend: "worsening",
  progress_pct: 659,
};

describe("SavingsCard", () => {
  it("shows negative net with a gentle message", () => {
    renderUI(<SavingsCard savings={base} />);
    expect(screen.getAllByText("-Rp 89.491.625")).toHaveLength(2);
    expect(screen.getByText("Masih minus nih... Tapi gapapa, pelan-pelan")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("encourages when improving", () => {
    renderUI(<SavingsCard savings={{ ...base, trend: "improving" }} />);
    expect(screen.getByText("Wah mulai membaik! 🐷✨")).toBeInTheDocument();
  });

  it("celebrates positive savings", () => {
    renderUI(<SavingsCard savings={{ ...base, net_savings: "500000.00", expense_total: "15500000.00", progress_pct: 97 }} />);
    expect(screen.getAllByText("+Rp 500.000")[0]).toBeInTheDocument();
    expect(screen.getByText("Tabungan positif! 🎉🐷🎊")).toBeInTheDocument();
  });
});
