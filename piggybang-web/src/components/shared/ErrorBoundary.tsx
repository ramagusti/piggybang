"use client";
import { useTranslations } from "next-intl";
import { Piggy } from "@/components/piggy/Piggy";
import { Button } from "@/components/ui/button";

/** Error state (spec §5.3). Route-level crashes use app/[locale]/error.tsx which renders this. */
export function ErrorState({
  onRetry,
  message,
}: {
  onRetry?: () => void;
  message?: string;
}) {
  const t = useTranslations();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-4 py-10 text-center"
    >
      <Piggy state="bandage" size={88} />
      <p className="text-lg font-semibold">{t("common.error")}</p>
      <p className="text-sm text-muted-foreground">
        {message ?? t("common.loadFailed")}
      </p>
      {onRetry && <Button onClick={onRetry}>{t("common.retry")}</Button>}
    </div>
  );
}
