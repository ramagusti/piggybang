import { PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  hideText,
}: {
  className?: string;
  hideText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <PiggyBank className="size-5" aria-hidden />
      </span>
      {!hideText && <span className="text-lg tracking-tight">Piggybang</span>}
    </span>
  );
}
