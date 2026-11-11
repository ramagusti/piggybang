import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderUI } from "@/test/render";
import { CategoryPicker } from "./CategoryPicker";

const cats = [
  { id: 1, name: "Food & Beverages", icon: null, color: "#4F46E5" },
  { id: 2, name: "Transportation", icon: "🚗", color: null },
  { id: 3, name: "Kid's Stuff", icon: null, color: null },
];

describe("CategoryPicker", () => {
  it("shows placeholder, then filters and selects", async () => {
    const onChange = vi.fn();
    renderUI(
      <CategoryPicker categories={cats} value={null} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText("Cari"), "trans");
    expect(screen.queryByText("Kid's Stuff")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Transportation"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("offers 'no category' only when clearable and something is picked", async () => {
    const onClear = vi.fn();
    const { unmount } = renderUI(
      <CategoryPicker categories={cats} value={null} onChange={() => {}} onClear={onClear} />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByText("Tanpa kategori")).not.toBeInTheDocument();
    unmount();
    renderUI(<CategoryPicker categories={cats} value={2} onChange={() => {}} onClear={onClear} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByText("Tanpa kategori"));
    expect(onClear).toHaveBeenCalled();
  });

  it("lists recent first and offers create-new", async () => {
    const onCreate = vi.fn();
    renderUI(
      <CategoryPicker
        categories={cats}
        value={1}
        onChange={() => {}}
        recentIds={[3]}
        onCreate={onCreate}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Food & Beverages");
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("Terakhir")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("Cari"), "Padel");
    await userEvent.click(screen.getByText("Buat baru: Padel"));
    expect(onCreate).toHaveBeenCalledWith("Padel");
  });
});
