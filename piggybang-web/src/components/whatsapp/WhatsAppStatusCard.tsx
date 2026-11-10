"use client";
import { MessageCircle, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Disconnected state: link this team to the shared Piggybang WhatsApp number (comes with Pro). */
export function WhatsAppStatusCard({ onConnect }: { onConnect: () => void }) {
  const t = useTranslations("whatsapp");
  return (
    <section className="space-y-4 rounded-xl border bg-surface p-5" aria-labelledby="wa-connect">
      <h2 id="wa-connect" className="flex items-center gap-2 text-lg font-semibold">
        <MessageCircle aria-hidden /> {t("connect")}
      </h2>
      <p className="text-muted-foreground">{t("connectBody")}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{t("howReact")}</li>
        <li>{t("howText")}</li>
      </ul>
      <Button onClick={onConnect}>
        <QrCode /> {t("connectCta")}
      </Button>
    </section>
  );
}
