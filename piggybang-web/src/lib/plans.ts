// Mirror of piggybang-api/config/billing.php (IDR). Paid tiers share every Pro feature and differ only in
// how many WhatsApp text replies the bot sends per month; ✅ reactions are unlimited.
// Monthly is priced 10% higher (it carries a payment fee every month); yearly ≈ 24% cheaper → promoted.
export const TIERS = [
  { key: "pro", name: "Pro", monthly: 55000, yearly: 500000, botReplies: 50 },
  { key: "plus", name: "Plus", monthly: 110000, yearly: 1000000, botReplies: 150 },
  { key: "max", name: "Max", monthly: 220000, yearly: 2000000, botReplies: 350 },
] as const;
/** % saved by paying yearly vs 12 monthly payments, e.g. 24. */
export const yearlySaving = (t: { monthly: number; yearly: number }) => Math.round((1 - t.yearly / (t.monthly * 12)) * 100);
/** Compact rupiah for marketing copy: 55000 → "Rp 55k", 1000000 → "Rp 1jt". */
export const shortRp = (n: number) => (n >= 1e6 ? `Rp ${n / 1e6}jt` : `Rp ${n / 1000}k`);
export const PAYMENT_METHODS = "QRIS, OVO, DANA, ShopeePay, LinkAja"; // mirror of XENDIT_PAYMENT_METHODS
export type TierKey = (typeof TIERS)[number]["key"];
// Add-ons on top of any paid tier, charged pro rata mid-period: under ADDON_INVOICE_MIN they apply at once and
// join the next invoice; from it (or when cancelling) they're invoiced now. Mirror of config/billing.php.
export const SEAT = { monthly: 15000, yearly: 150000, botReplies: 10 };
export const BOT_PACK = { monthly: 30000, yearly: 300000, replies: 50 };
export const ADDON_INVOICE_MIN = 25000;
export const TRIAL_DAYS = 3;
