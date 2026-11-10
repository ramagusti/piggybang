"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { queryKeys } from "@/hooks/api";
import { useUIStore } from "@/stores/ui";

interface RealtimeToken {
  url: string;
  anon_key: string;
  schema?: string;
  token: string;
  expires_at: string;
}

const TABLES = ["transactions", "savings", "bills"] as const;

/** Supabase Realtime → invalidate org queries. Silently does nothing when the API returns 204 (not configured). */
export function useRealtime(orgId: number | undefined) {
  const qc = useQueryClient();
  const bumpNewTx = useUIStore((s) => s.bumpNewTx);

  useEffect(() => {
    if (!orgId) return;
    let cleanup = () => {};
    let cancelled = false;

    api<RealtimeToken | undefined>(`/organizations/${orgId}/realtime-token`)
      .then((cfg) => {
        if (!cfg || cancelled) return;
        const supabase = createClient(cfg.url, cfg.anon_key, { accessToken: async () => cfg.token });
        supabase.realtime.setAuth(cfg.token);
        const channels = TABLES.map((table) =>
          supabase
            .channel(`org:${orgId}:${table}`)
            .on("postgres_changes", { event: "*", schema: cfg.schema ?? "public", table, filter: `organization_id=eq.${orgId}` }, (payload) => {
              if (table === "transactions" && payload.eventType === "INSERT") bumpNewTx();
              qc.invalidateQueries({ queryKey: queryKeys.org(orgId) });
            })
            .subscribe(),
        );
        // ponytail: token not refreshed before expires_at; re-fetch on expiry if sessions run long.
        cleanup = () => channels.forEach((c) => supabase.removeChannel(c));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [orgId, qc, bumpNewTx]);
}
