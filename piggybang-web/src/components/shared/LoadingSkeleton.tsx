import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LoadingSkeleton({
  variant = "list",
  count = 3,
}: {
  variant?: "cards" | "list" | "table";
  count?: number;
}) {
  const items = Array.from({ length: count });
  if (variant === "cards") {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-busy="true"
      >
        {items.map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2" aria-busy="true">
      {items.map((_, i) => (
        <Skeleton
          key={i}
          className={cn("rounded-lg", variant === "table" ? "h-10" : "h-14")}
        />
      ))}
    </div>
  );
}
