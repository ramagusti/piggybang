"use client";
import { useState } from "react";
import { Calculator, Delete } from "lucide-react";
import { useTranslations } from "next-intl";
import { evaluate } from "@/lib/calc";
import { parseAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

const fmt = (v: number | null) =>
  v === null ? "" : new Intl.NumberFormat("id-ID").format(v);
// Plain digits (with "." grouping) format live; anything else ("25rb", "1,5jt", "25+5") is calculated.
const isPlain = (s: string) => /^[\d.\s]*$/.test(s);
const KEYS = [
  "7",
  "8",
  "9",
  "÷",
  "4",
  "5",
  "6",
  "×",
  "1",
  "2",
  "3",
  "−",
  "000",
  "0",
  "⌫",
  "+",
  "C",
  "(",
  ")",
  "=",
];

/**
 * Rupiah amount input: shows "25.000", emits 25000 (or null when empty). Also accepts sums like
 * "25rb+15rb*2" (live "= Rp 55.000" preview, committed on blur/Enter). `calculator` adds a keypad,
 * since phone number keyboards have no + or ×.
 */
export function AmountInput({
  value,
  onChange,
  id,
  prefix = "Rp",
  invalid,
  className,
  calculator = false,
  ...rest
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  id?: string;
  prefix?: string;
  invalid?: boolean;
  className?: string;
  calculator?: boolean;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "prefix">) {
  const t = useTranslations("calc");
  const [text, setText] = useState<string | null>(null); // non-null while editing
  const [pad, setPad] = useState(false);
  const editing = text !== null;
  const expr = editing && !isPlain(text);
  const result = expr ? evaluate(text) : null;

  const edit = (next: string) => {
    const plain = isPlain(next);
    setText(plain ? fmt(parseAmount(next)) : next);
    onChange(plain ? parseAmount(next) : evaluate(next));
  };
  const commit = () => {
    if (expr && result !== null) onChange(result);
    setText(null);
  };
  const press = (k: string) => {
    const cur = text ?? fmt(value);
    if (k === "=") {
      setPad(false);
      return commit();
    }
    if (k === "C") return edit("");
    if (k === "⌫") return edit(cur.slice(0, -1));
    edit(cur + (/[÷×−+]/.test(k) ? ` ${k} ` : k));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "flex h-11 items-center overflow-hidden rounded-lg border border-input bg-surface transition-[border-color,box-shadow] duration-200 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          invalid && "border-destructive",
        )}
      >
        <span className="border-r border-input bg-muted px-3 py-2.5 text-sm font-medium text-muted-foreground">
          {prefix}
        </span>
        <input
          id={id}
          // Keypad open → suppress the phone keyboard; the keypad is the input.
          inputMode={pad ? "none" : "decimal"}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          className="h-full w-full min-w-0 bg-transparent px-3 text-base tabular-nums outline-none"
          value={editing ? text : fmt(value)}
          onFocus={() => !editing && setText(fmt(value))}
          onChange={(e) => edit(e.target.value)}
          onBlur={() => !pad && commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && expr) {
              e.preventDefault();
              commit();
            }
          }}
          {...rest}
        />
        {calculator && (
          <button
            type="button"
            aria-label={t("toggle")}
            aria-pressed={pad}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (pad) commit();
              else if (!editing) setText(fmt(value));
              setPad(!pad);
            }}
            className={cn(
              "grid h-full w-11 shrink-0 place-items-center border-l border-input transition-colors duration-200",
              pad
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Calculator className="size-4" />
          </button>
        )}
      </div>
      {expr && (
        <p
          className="animate-in text-sm tabular-nums fade-in-0 duration-150"
          aria-live="polite"
        >
          {result === null ? (
            <span className="text-danger">{t("invalid")}</span>
          ) : (
            <span className="font-semibold">
              = {prefix} {fmt(result)}
            </span>
          )}
        </p>
      )}
      {pad && (
        <div
          className="grid animate-in grid-cols-4 gap-1.5 fade-in-0 slide-in-from-top-1 duration-200"
          role="group"
          aria-label={t("keypad")}
        >
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep focus in the input
              onClick={() => press(k)}
              aria-label={
                k === "⌫" ? t("backspace") : k === "C" ? t("clear") : undefined
              }
              className={cn(
                "grid h-11 place-items-center rounded-lg text-base font-medium tabular-nums transition-[background-color,transform] duration-150 active:scale-95",
                k === "="
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : /[÷×−+()]/.test(k)
                    ? "bg-primary-bg text-primary hover:bg-primary-bg/70"
                    : k === "C"
                      ? "bg-danger-light/50 text-danger"
                      : "bg-muted hover:bg-muted/70",
              )}
            >
              {k === "⌫" ? <Delete className="size-4" /> : k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
