"use client";
import { useState } from "react";
import { LogOut, Menu, Moon, Plus, Settings, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { InstallButton } from "@/components/shared/InstallButton";
import { Logo } from "@/components/shared/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMe } from "@/hooks/api";
import { Link, useRouter } from "@/i18n/navigation";
import { api, clearToken } from "@/lib/api";
import { useUIStore } from "@/stores/ui";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CreateOrgDialog, OrgSwitcher } from "./OrgSwitcher";
import { NavLinks } from "./Sidebar";

export const initials = (name?: string) =>
  (name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export function Navbar() {
  const t = useTranslations();
  const { data } = useMe();
  const { resolvedTheme, setTheme } = useTheme();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const router = useRouter();
  const qc = useQueryClient();
  const [mobileNav, setMobileNav] = useState(false);
  const [creating, setCreating] = useState(false);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    clearToken();
    qc.clear();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-surface/95 backdrop-blur">
      <div className="flex h-full items-center gap-2 px-2 md:px-4">
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" aria-label={t("nav.toggleSidebar")} onClick={toggleSidebar}>
          <Menu />
        </Button>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("nav.openMenu")} onClick={() => setMobileNav(true)}>
          <Menu />
        </Button>
        <Link href="/app/dashboard" aria-label="Piggybang" className="mr-2">
          <Logo className="hidden sm:inline-flex" />
          <Logo hideText className="sm:hidden" />
        </Link>
        <OrgSwitcher />
        <div className="ml-auto flex items-center gap-1">
          <InstallButton />
          <span className="hidden md:inline-flex">
            <LanguageSwitcher />
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label={t("settings.toggleTheme")}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="dark:hidden" />
            <Moon className="hidden dark:block" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("nav.account")}>
                <Avatar className="size-9">
                  {data?.user.avatar_url && <AvatarImage src={data.user.avatar_url} alt="" />}
                  <AvatarFallback className="bg-primary-bg text-primary">{initials(data?.user.name)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <p className="truncate font-semibold">{data?.user.name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{data?.user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="min-h-11">
                <Link href="/app/settings">
                  <Settings /> {t("nav.settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => setCreating(true)}>
                <Plus /> {t("org.create")}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11 md:hidden" onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                <Moon /> {t("settings.toggleTheme")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11" onSelect={logout}>
                <LogOut /> {t("auth.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="p-3">
          <SheetHeader>
            <SheetTitle>
              <Logo />
            </SheetTitle>
            <SheetDescription className="sr-only">{t("nav.label")}</SheetDescription>
          </SheetHeader>
          <NavLinks onNavigate={() => setMobileNav(false)} />
        </SheetContent>
      </Sheet>
      <CreateOrgDialog open={creating} onOpenChange={setCreating} />
    </header>
  );
}
