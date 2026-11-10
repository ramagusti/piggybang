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
const POLL_MS = 20_000;

/**
 * Keeps every page of a team fresh: any change to its transactions, savings or bills (web or WhatsApp, any
 * member) → refetch that team's queries. Supabase Realtime when available; the token (1h) is renewed a minute
 * before it expires. If Realtime isn't configured or the connection fails, falls back to refetching every 20s
 * while the tab is visible.
 */
export function useRealtime(orgId: number | undefined) {
  const qc = useQueryClient();
  const bumpNewTx = useUIStore((s) => s.bumpNewTx);

  useEffect(() => {
    if (!orgId) return;
    let stopped = false;
    let disconnect = () => {};
    let renew: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.org(orgId) });
    const setPolling = (on: boolean) => {
      if (on && !poll) poll = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS);
      if (!on && poll) poll = void clearInterval(poll);
    };

    async function connect() {
      const cfg = await api<RealtimeToken | undefined>(`/organizations/${orgId}/realtime-token`).catch(() => undefined);
      if (stopped) return;
      disconnect();
      if (!cfg) return setPolling(true); // not configured (204) or API error
      const supabase = createClient(cfg.url, cfg.anon_key, { accessToken: async () => cfg.token });
      supabase.realtime.setAuth(cfg.token);
      const live = new Set<string>();
      const channels = TABLES.map((table) =>
        supabase
          .channel(`org:${orgId}:${table}`)
          .on("postgres_changes", { event: "*", schema: cfg.schema ?? "public", table, filter: `organization_id=eq.${orgId}` }, (payload) => {
            if (table === "transactions" && payload.eventType === "INSERT") bumpNewTx();
            refresh();
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") live.add(table);
            else live.delete(table);
            setPolling(live.size < TABLES.length); // poll only while a channel is down
          }),
      );
      disconnect = () => {
        channels.forEach((c) => supabase.removeChannel(c));
        disconnect = () => {};
      };
      renew = setTimeout(connect, Math.max(30_000, new Date(cfg.expires_at).getTime() - Date.now() - 60_000));
    }
    connect();

    return () => {
      stopped = true;
      clearTimeout(renew);
      setPolling(false);
      disconnect();
    };
  }, [orgId, qc, bumpNewTx]);
}
