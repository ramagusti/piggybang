"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { Piggy } from "@/components/piggy/Piggy";
import { ErrorState } from "@/components/shared/ErrorBoundary";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface Pairing {
  pairing_code: string;
  wa_link: string;
  expires_at: string;
}

/** Shows wa.me QR + pairing code; parent polls connection status and closes on `connected`. */
export function AllInConnectModal({ orgId, open, onOpenChange }: { orgId: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    api<Pairing>(`/organizations/${orgId}/whatsapp/all-in/start`, { method: "POST" }).then(
      (p) => alive && setPairing(p),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [open, orgId]);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setPairing(null);
          setFailed(false);
        }
      }}
      title={t("whatsapp.connectCta")}
    >
      {failed ? (
        <ErrorState />
      ) : !pairing ? (
        <div className="grid place-items-center py-8">
          <Piggy state="idle" size={72} className="animate-piggy-walk" label={t("whatsapp.connecting")} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <Piggy state="wave" size={48} message={t("whatsapp.allInIntro")} />
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={pairing.wa_link} size={208} aria-label={t("whatsapp.qrLabel")} />
          </div>
          <p className="text-sm text-muted-foreground">{t("whatsapp.orCode")}</p>
          <p className="font-mono text-2xl font-bold tracking-[0.3em]">{pairing.pairing_code}</p>
          <Button asChild variant="outline">
            <a href={pairing.wa_link} target="_blank" rel="noopener noreferrer">
              {t("whatsapp.openWhatsApp")}
            </a>
          </Button>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("whatsapp.allInSteps")}
          </p>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      )}
    </ResponsiveModal>
  );
}
