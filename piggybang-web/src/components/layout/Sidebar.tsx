"use client";
import { useTranslations } from "next-intl";
import { Piggy } from "@/components/piggy/Piggy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import { NAV } from "./nav";

export function NavLinks({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const t = useTranslations();
  const pathname = usePathname();
  const newTx = useUIStore((s) => s.newTxCount);
  return (
    <ul className="space-y-1">
      {NAV.map(({ key, href, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <li key={key}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? t(`nav.${key}`) : undefined}
              className={cn(
                "group/nav flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-[color,background-color] duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                active ? "bg-primary-bg text-primary" : "text-muted-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="size-5 shrink-0 transition-transform duration-200 group-hover/nav:scale-110" aria-hidden />
              <span className={cn(collapsed && "sr-only")}>{t(`nav.${key}`)}</span>
              {key === "transactions" && newTx > 0 && !collapsed && <Badge className="ml-auto">{newTx}</Badge>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** md: icon rail, lg: full 240px (spec §8). Upgrade banner on Free. */
export function Sidebar({ showUpgrade }: { showUpgrade: boolean }) {
  const t = useTranslations();
  const collapsedPref = useUIStore((s) => s.sidebarCollapsed);
  return (
    <aside className={cn("sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col border-r bg-surface p-3 md:flex md:w-16", collapsedPref ? "lg:w-16" : "lg:w-60")} aria-label={t("nav.label")}>
      <nav className="flex-1 overflow-y-auto">
        <div className="lg:hidden">
          <NavLinks collapsed />
        </div>
        <div className="hidden lg:block">
          <NavLinks collapsed={collapsedPref} />
        </div>
      </nav>
      {showUpgrade && !collapsedPref && (
        <div className="mt-3 hidden flex-col items-center gap-2 rounded-xl bg-primary-bg p-3 text-center lg:flex">
          <Piggy state="point" size={56} />
          <p className="text-sm font-medium">{t("nav.upgradeTitle")}</p>
          <Button size="sm" asChild>
            <Link href="/app/settings?tab=billing">{t("billing.upgrade")}</Link>
          </Button>
        </div>
      )}
    </aside>
  );
}
