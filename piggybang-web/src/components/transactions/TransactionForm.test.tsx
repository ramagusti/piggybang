import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderUI } from "@/test/render";
import type { Category } from "@/types";
import { TransactionForm } from "./TransactionForm";

const cat = (id: number, name: string, type: "income" | "expense"): Category => ({
  id,
  name,
  type,
  icon: null,
  color: null,
  sort_order: id,
  is_system: false,
  transactions_count: 0,
});
const categories = [cat(1, "Food & Beverages", "expense"), cat(2, "Salary", "income")];

describe("TransactionForm", () => {
  it("validates required fields", async () => {
    const onSubmit = vi.fn();
    renderUI(<TransactionForm categories={categories} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Simpan Transaksi" }));
    expect(screen.getByText("Pilih kategori.")).toBeInTheDocument();
    expect(screen.getByText("Masukkan jumlah lebih dari 0.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits typed values; switching type filters categories", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderUI(<TransactionForm categories={categories} defaultActor="Rama" onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByText("Salary")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Food & Beverages"));
    await userEvent.type(screen.getByLabelText("Jumlah"), "25000");
    await userEvent.type(screen.getByLabelText("Deskripsi"), "mixue");
    await userEvent.click(screen.getByRole("button", { name: "Simpan Transaksi" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    const v = onSubmit.mock.calls[0][0];
    expect(v).toMatchObject({ type: "expense", category_id: 1, amount: 25000, currency: "IDR", description: "mixue", actor: "Rama", proof: null });
    expect(new Date(v.transaction_time).toString()).not.toBe("Invalid Date");
  });

  it("fills fields from OCR", async () => {
    const onOcr = vi.fn().mockResolvedValue({ amount: 32000, description: "mixue", date: null });
    renderUI(<TransactionForm categories={categories} onSubmit={vi.fn()} onOcr={onOcr} />);
    const file = new File(["x"], "struk.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText("Bukti (foto struk)"), file);
    expect(await screen.findByText("Piggy baca struk kamu!")).toBeInTheDocument();
    expect(screen.getByLabelText("Jumlah")).toHaveValue("32.000");
    expect(screen.getByLabelText("Deskripsi")).toHaveValue("mixue");
  });
  it("calculator: typed sum becomes the amount", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderUI(<TransactionForm categories={categories} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByText("Food & Beverages"));
    await userEvent.type(screen.getByLabelText("Jumlah"), "25rb+15rb*2");
    expect(screen.getByText("= Rp 55.000")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Simpan Transaksi" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ amount: 55000 });
  });

  it("split bill: even split submits parts that add up to the total", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderUI(<TransactionForm categories={categories} defaultActor="Rama" people={["Rama", "Salsa"]} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByText("Food & Beverages"));
    await userEvent.type(screen.getByLabelText("Jumlah"), "100001");
    await userEvent.click(screen.getByRole("switch", { name: /Bagi tagihan/ }));
    await userEvent.type(screen.getByLabelText("Orang bagian 2"), "Salsa");
    await userEvent.click(screen.getByRole("button", { name: /Bagi rata/ }));
    expect(screen.getByText("✓ Pas")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Simpan Transaksi" }));

    expect(onSubmit.mock.calls[0][0].splits).toEqual([
      { amount: 50001, category_id: 1, actor: "Rama" },
      { amount: 50000, category_id: 1, actor: "Salsa" },
    ]);
  });
});
