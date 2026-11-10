export { cn } from "cn"

/** Only same-origin relative paths (prevents open redirects via ?next=). */
export const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : null);
