import { Piggy, type PiggyState } from "@/components/piggy/Piggy";

export function EmptyState({
  title,
  description,
  action,
  piggy = "point",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  piggy?: PiggyState | null;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      {piggy && <Piggy state={piggy} size={88} />}
      <p className="text-lg font-semibold">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}
