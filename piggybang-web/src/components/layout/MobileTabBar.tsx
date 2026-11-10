"use client";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import { NAV, TAB_BAR } from "./nav";

export function MobileTabBar() {
  const t = useTranslations();
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const newTx = useUIStore((s) => s.newTxCount);
  const tabs = NAV.filter((n) => (TAB_BAR as readonly string[]).includes(n.key));
  const rest = NAV.filter((n) => !(TAB_BAR as readonly string[]).includes(n.key));
  const moreActive = rest.some((n) => pathname.startsWith(n.href));

  const item = "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200 active:[&_svg]:scale-90 [&_svg]:transition-transform [&_svg]:duration-200 aria-[current=page]:[&_svg]:-translate-y-0.5";
  return (
    <>
      <nav aria-label={t("nav.label")} className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs.map(({ key, href, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={key} href={href} aria-current={active ? "page" : undefined} className={cn(item, active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" aria-hidden />
              {t(`nav.${key}Short`)}
              {key === "transactions" && newTx > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-18px)] grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-white">{newTx}</span>
              )}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMore(true)} className={cn(item, moreActive ? "text-primary" : "text-muted-foreground")} aria-haspopup="dialog">
          <MoreHorizontal className="size-5" aria-hidden />
          {t("nav.more")}
        </button>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle>{t("nav.more")}</SheetTitle>
            <SheetDescription className="sr-only">{t("nav.more")}</SheetDescription>
          </SheetHeader>
          <ul className="grid grid-cols-3 gap-2 px-4">
            {rest.map(({ key, href, icon: Icon }) => (
              <li key={key}>
                <Link href={href} onClick={() => setMore(false)} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl bg-primary-bg/60 text-sm font-medium">
                  <Icon className="size-6 text-primary" aria-hidden />
                  {t(`nav.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
