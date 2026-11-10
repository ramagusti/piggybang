export type NumberStyle = "id" | "intl"; // "Rp 1.234.567" | "IDR 1,234,567"

interface MoneyOpts {
  currency?: string;
  compact?: boolean; // ≥1 juta → "Rp 4,5 JT", ≥1 miliar → "Rp 1,2 M"
  style?: NumberStyle;
  sign?: boolean; // prefix "+" for positive
}

export function formatMoney(value: string | number | null | undefined, opts: MoneyOpts = {}) {
  const n = Number(value ?? 0) || 0;
  const { currency = "IDR", compact = false, style = "id", sign = false } = opts;
  const locale = style === "id" ? "id-ID" : "en-US";
  const abs = Math.abs(n);
  const prefix = n < 0 ? "-" : sign && n > 0 ? "+" : "";

  if (currency !== "IDR") {
    return prefix + new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(abs);
  }
  const symbol = style === "id" ? "Rp" : "IDR";
  if (compact && abs >= 1e6) {
    const [div, suffix] = abs >= 1e9 ? [1e9, "M"] : [1e6, "JT"];
    const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(abs / div);
    return `${prefix}${symbol} ${num} ${suffix}`;
  }
  return `${prefix}${symbol} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(abs)}`;
}

/** Digits-only parse for amount inputs: "25.000" → 25000. */
export function parseAmount(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

export function formatDate(iso: string | null | undefined, locale: string, withTime = false) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
}

/** ISO → value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string | Date = new Date()) {
  const d = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
