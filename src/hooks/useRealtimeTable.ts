import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Postgres changes on a table and run `onChange` whenever
 * an INSERT/UPDATE/DELETE happens. The callback typically refetches the
 * list. Lightweight: a single websocket per channel, no polling.
 *
 * Pré-requisito: a tabela precisa estar na `supabase_realtime` publication.
 *
 * @param table  Nome da tabela (ex: "blog_posts")
 * @param onChange  Callback disparado em cada mudança (debounced internamente)
 * @param enabled  Permite desativar dinamicamente (default: true)
 */
export function useRealtimeTable(
  table: string,
  onChange: () => void,
  enabled: boolean = true
) {
  // Guarda referência estável do callback para não recriar canal a cada render
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      // Debounce 300ms — agrupa rajadas de mudanças (ex: bulk update)
      debounceTimer = setTimeout(() => cbRef.current(), 300);
    };

    const channel = supabase
      .channel(`realtime:${table}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => fire()
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [table, enabled]);
}
