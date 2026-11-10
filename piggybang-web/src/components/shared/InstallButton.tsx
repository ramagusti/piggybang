"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";

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

/**
 * "Install app" for mobile browsers only. Hidden when already running as the installed app.
 * Android/Chrome: native prompt via beforeinstallprompt. iOS Safari has no prompt API → show Share → Add to Home Screen steps.
 */
export function InstallButton() {
  const t = useTranslations("pwa");
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const ios = useSyncExternalStore(noop, iosBrowser, () => false);
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

  if (!prompt && !ios) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="animate-in rounded-full fade-in-0 zoom-in-95 duration-300"
        onClick={async () => {
          if (!prompt) return setHelp(true);
          await prompt.prompt();
          if ((await prompt.userChoice).outcome === "accepted") setPrompt(null);
        }}
      >
        <Download /> {t("install")}
      </Button>
      <ResponsiveModal open={help} onOpenChange={setHelp} title={t("iosTitle")}>
        <ol className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <Share className="size-5 shrink-0 text-primary" aria-hidden />{" "}
            {t("iosStep1")}
          </li>
          <li className="flex items-center gap-3">
            <SquarePlus className="size-5 shrink-0 text-primary" aria-hidden />{" "}
            {t("iosStep2")}
          </li>
        </ol>
        <Button className="mt-5 w-full" onClick={() => setHelp(false)}>
          {t("ok")}
        </Button>
      </ResponsiveModal>
    </>
  );
}
