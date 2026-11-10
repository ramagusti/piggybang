"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { formatDate, formatMoney } from "@/lib/format";
import { useUIStore } from "@/stores/ui";

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

const noop = () => () => {};
/** true after hydration (client), false during SSR — without setState-in-effect. */
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export const useIsDesktop = () => useMediaQuery("(min-width: 768px)");

/** Money + date formatters bound to user prefs. */
export function useFormat() {
  const style = useUIStore((s) => s.numberStyle);
  const locale = useLocale();
  return {
    money: (v: string | number | null | undefined, o: Parameters<typeof formatMoney>[1] = {}) => formatMoney(v, { style, ...o }),
    date: (iso: string | null | undefined, withTime = false) => formatDate(iso, locale, withTime),
    locale,
  };
}
