"use client";
import { useLocale, useTranslations } from "next-intl";
import { Flag } from "@/components/shared/Flag";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { api, getToken } from "@/lib/api";

export function useSwitchLocale() {
  const router = useRouter();
  const pathname = usePathname();
  return (locale: "id" | "en") => {
    router.replace(pathname + window.location.search, { locale });
    if (getToken()) api("/user", { method: "PATCH", body: { locale } }).catch(() => {});
  };
}

/** Compact toggle id ⇄ en. */
export function LanguageSwitcher({ withLabel }: { withLabel?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const switchLocale = useSwitchLocale();
  const next = locale === "id" ? "en" : "id";
  return (
    <Button variant="ghost" size={withLabel ? "sm" : "icon"} aria-label={t("common.switchLanguage")} onClick={() => switchLocale(next)}>
      <Flag locale={next} />
      {withLabel && (locale === "id" ? "English" : "Bahasa Indonesia")}
    </Button>
  );
}
