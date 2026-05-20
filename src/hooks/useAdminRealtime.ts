import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assina mudanças (INSERT/UPDATE/DELETE) em uma OU mais tabelas e dispara
 * `onChange` com debounce. Pensado para páginas dentro de /admin onde a
 * edição precisa refletir instantaneamente em todas as abas abertas.
 *
 * Diferente de `useRealtimeTable`, aceita um array — útil para telas que
 * listam dados de múltiplas tabelas relacionadas (ex: links + grupos).
 *
 * Requisitos: cada tabela precisa estar na publication `supabase_realtime`.
 */
export function useAdminRealtime(
  tables: string | string[],
  onChange: () => void,
  enabled: boolean = true,
) {
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  const tableList = Array.isArray(tables) ? tables : [tables];
  const tableKey = tableList.slice().sort().join(",");

  useEffect(() => {
    if (!enabled || tableList.length === 0) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => cbRef.current(), 300);
    };

    const channel = supabase.channel(
      `admin-realtime:${tableKey}:${Math.random().toString(36).slice(2, 8)}`,
    );

    for (const t of tableList) {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: t },
        () => fire(),
      );
    }

    channel.subscribe((status) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug(`[useAdminRealtime] ${tableKey} → ${status}`);
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey, enabled]);
}
