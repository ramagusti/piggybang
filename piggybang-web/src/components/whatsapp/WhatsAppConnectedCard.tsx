"use client";
import { CheckCircle2, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { WhatsAppConnection } from "@/types";

export function WhatsAppConnectedCard({
  connection,
  onLink,
  onTest,
  onDisconnect,
  busy,
}: {
  connection: WhatsAppConnection;
  onLink?: () => void;
  onTest?: () => void; // owners/admins only
  onDisconnect?: () => void; // owners/admins only
  busy?: boolean;
}) {
  const t = useTranslations();
  return (
    <section className="space-y-4 rounded-xl border bg-surface p-5" aria-labelledby="wa-connected">
      <h2 id="wa-connected" className="flex items-center gap-2 text-lg font-semibold text-success-dark dark:text-success">
        <CheckCircle2 aria-hidden /> {t("whatsapp.connected")}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {connection.phone_number && (
          <>
            <dt className="text-muted-foreground">{t("whatsapp.number")}</dt>
            <dd className="font-medium">{connection.phone_number}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t("whatsapp.conversations")}</dt>
        <dd className="font-medium tabular-nums">
          {connection.monthly_conversations} / {connection.conversation_limit ?? "∞"}
        </dd>
        {connection.linked_senders.length > 0 && (
          <>
            <dt className="text-muted-foreground">{t("whatsapp.linkedSenders")}</dt>
            <dd className="font-medium">{connection.linked_senders.join(", ")}</dd>
          </>
        )}
      </dl>
      <p className="text-sm text-muted-foreground">{t("whatsapp.linkHint")}</p>
      <div className="flex flex-wrap gap-2">
        {onLink && (
          <Button onClick={onLink}>
            <QrCode /> {t("whatsapp.linkMine")}
          </Button>
        )}
        {onTest && (
          <Button variant="outline" onClick={onTest} disabled={busy}>
            {t("whatsapp.test")}
          </Button>
        )}
        {onDisconnect && (
          <Button variant="destructive" onClick={onDisconnect} disabled={busy}>
            {t("whatsapp.disconnect")}
          </Button>
        )}
      </div>
    </section>
  );
}
