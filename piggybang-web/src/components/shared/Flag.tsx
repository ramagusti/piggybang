import { useId } from "react";
import { cn } from "@/lib/utils";

/** SVG flags: emoji flags don't render on Windows (they show "ID"/"GB"). */
export function Flag({
  locale,
  className,
}: {
  locale: "id" | "en";
  className?: string;
}) {
  const id = useId();
  const cls = cn(
    "inline-block h-3.5 w-5 shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.08)]",
    className,
  );
  if (locale === "id") {
    return (
      <svg viewBox="0 0 3 2" className={cls} aria-hidden>
        <rect width="3" height="1" fill="#E70011" />
        <rect y="1" width="3" height="1" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 60 30"
      preserveAspectRatio="xMidYMid slice"
      className={cls}
      aria-hidden
    >
      <clipPath id={`${id}t`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        clipPath={`url(#${id}t)`}
        stroke="#C8102E"
        strokeWidth="4"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
