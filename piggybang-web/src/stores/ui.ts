import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NumberStyle } from "@/lib/format";

interface UIState {
  sidebarCollapsed: boolean;
  numberStyle: NumberStyle;
  newTxCount: number;
  toggleSidebar: () => void;
  setNumberStyle: (s: NumberStyle) => void;
  bumpNewTx: () => void;
  resetNewTx: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      numberStyle: "id",
      newTxCount: 0,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setNumberStyle: (numberStyle) => set({ numberStyle }),
      bumpNewTx: () => set((s) => ({ newTxCount: s.newTxCount + 1 })),
      resetNewTx: () => set({ newTxCount: 0 }),
    }),
    { name: "pb-ui", partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, numberStyle: s.numberStyle }) },
  ),
);
