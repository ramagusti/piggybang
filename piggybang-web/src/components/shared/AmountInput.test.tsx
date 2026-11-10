import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderUI } from "@/test/render";
import { AmountInput } from "./AmountInput";

function Harness({ onChange }: { onChange: (v: number | null) => void }) {
  const [v, setV] = useState<number | null>(null);
  return (
    <AmountInput
      aria-label="amount"
      value={v}
      onChange={(n) => {
        setV(n);
        onChange(n);
      }}
    />
  );
}

describe("AmountInput", () => {
  it("formats while typing and emits numbers", async () => {
    const onChange = vi.fn();
    renderUI(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("amount");
    await userEvent.type(input, "25000");
    expect(input).toHaveValue("25.000");
    expect(onChange).toHaveBeenLastCalledWith(25000);
  });

  it("emits null when cleared and shows prefix", async () => {
    const onChange = vi.fn();
    renderUI(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("amount");
    await userEvent.type(input, "5");
    await userEvent.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("Rp")).toBeInTheDocument();
  });
  it("shorthand alone is calculated: 25rb → 25000", async () => {
    const onChange = vi.fn();
    renderUI(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("amount"), "25rb");
    expect(onChange).toHaveBeenLastCalledWith(25000);
  });
});
