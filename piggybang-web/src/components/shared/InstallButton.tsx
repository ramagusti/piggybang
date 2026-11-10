"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const installed = () =>
  matchMedia("(display-mode: standalone)").matches ||
  !!(navigator as { standalone?: boolean }).standalone;

// iPadOS reports as Macintosh; touch points give it away.
const iosBrowser = () =>
  !installed() &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

const noop = () => () => {};

// Dismissal: remembered for a week (and for this page view even if storage is blocked).
const KEY = "pb_install_dismissed_until";
let closedThisVisit = false;
const isDismissed = () => {
  if (closedThisVisit) return true;
  try {
    return Number(localStorage.getItem(KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
};
const onDismissChange = (cb: () => void) => {
  addEventListener("pb-install-dismiss", cb);
  return () => removeEventListener("pb-install-dismiss", cb);
};
function dismiss() {
  closedThisVisit = true;
  try {
    localStorage.setItem(KEY, String(Date.now() + 7 * 864e5));
  } catch {}
  dispatchEvent(new Event("pb-install-dismiss"));
}

/**
 * Floating "Install app" pill, bottom centre, for mobile browsers only. Hidden when already running as the
 * installed app or after the user closes it. Android/Chrome: native prompt via beforeinstallprompt.
 * iOS Safari has no prompt API → show Share → Add to Home Screen steps. Mounted in AppShell, so only logged-in users see it.
 */
export function InstallButton() {
  const t = useTranslations("pwa");
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const ios = useSyncExternalStore(noop, iosBrowser, () => false);
  const dismissed = useSyncExternalStore(onDismissChange, isDismissed, () => true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if (installed()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (/Android|Mobi/i.test(navigator.userAgent)) setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    addEventListener("beforeinstallprompt", onPrompt);
    addEventListener("appinstalled", onInstalled);
    return () => {
      removeEventListener("beforeinstallprompt", onPrompt);
      removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if ((!prompt && !ios) || dismissed) return null;

  return (
    <>
      <div
        className={cn(
          "fixed left-1/2 z-50 flex -translate-x-1/2 animate-in items-center rounded-full border bg-primary text-primary-foreground shadow-lg shadow-primary/30 duration-300 fade-in-0 slide-in-from-bottom-4",
          "bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] md:bottom-6", // above the mobile tab bar
        )}
      >
        <button
          type="button"
          className="flex min-h-12 items-center gap-2 rounded-l-full py-2 pr-3 pl-5 text-sm font-semibold whitespace-nowrap transition-transform active:scale-95"
          onClick={async () => {
            if (!prompt) return setHelp(true);
            await prompt.prompt();
            if ((await prompt.userChoice).outcome === "accepted") setPrompt(null);
          }}
        >
          <Download className="size-4" aria-hidden /> {t("install")}
        </button>
        <button
          type="button"
          aria-label={t("dismiss")}
          onClick={dismiss}
          className="mr-1 grid size-10 place-items-center rounded-full text-primary-foreground/80 transition-colors hover:bg-white/15 hover:text-primary-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <ResponsiveModal open={help} onOpenChange={setHelp} title={t("iosTitle")}>
        <ol className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <Share className="size-5 shrink-0 text-primary" aria-hidden /> {t("iosStep1")}
          </li>
          <li className="flex items-center gap-3">
            <SquarePlus className="size-5 shrink-0 text-primary" aria-hidden /> {t("iosStep2")}
          </li>
        </ol>
        <Button className="mt-5 w-full" onClick={() => setHelp(false)}>
          {t("ok")}
        </Button>
      </ResponsiveModal>
    </>
  );
}
