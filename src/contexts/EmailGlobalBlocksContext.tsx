/**
 * Contexto único da biblioteca de blocos globais de e-mail.
 *
 * Motivo: antes, cada componente que usava `useEmailGlobalBlocks()` criava
 * seu próprio cache. Isso fazia com que salvar um bloco global pela
 * biblioteca não refletisse no preview do editor (fallback "indisponível").
 *
 * Agora todos consomem o MESMO cache via este contexto, e qualquer
 * save/update/delete recarrega uma única fonte de verdade.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Block, GlobalBlock } from "@/lib/emailTemplates/blocks";
import { EmailGlobalBlocksContext, type EmailGlobalBlocksCtx as Ctx } from "./emailGlobalBlocksContextValue";

export function EmailGlobalBlocksProvider({ children }: { children: ReactNode }) {
  const [globals, setGlobals] = useState<GlobalBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase.from as any)("email_global_blocks")
        .select("id, name, description, category, block")
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      setGlobals((data || []) as GlobalBlock[]);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar blocos globais");
      setGlobals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const globalsMap = useMemo(
    () => new Map<string, GlobalBlock>(globals.map((g) => [g.id, g])),
    [globals],
  );

  const saveAsGlobal = useCallback(
    async (
      block: Block,
      meta: { name: string; description?: string; category?: string },
    ): Promise<GlobalBlock | null> => {
      if (block.kind === "global_ref") {
        throw new Error("Não é possível salvar uma referência como bloco global (evitando loops).");
      }
      // Remove o id local E a flag `hidden` do bloco antes de salvar.
      // `hidden` é uma propriedade da REFERÊNCIA no template, não do bloco global em si;
      // se herdada, faria o global sempre renderizar vazio em todos os templates.
      const { id: _localId, hidden: _localHidden, ...rest } = block as any;
      const cleanBlock = { id: "template", ...rest } as Block;
      const { data, error } = await (supabase.from as any)("email_global_blocks")
        .insert({
          name: meta.name,
          description: meta.description || null,
          category: meta.category || "geral",
          block: cleanBlock,
        })
        .select("id, name, description, category, block")
        .single();
      if (error) throw error;
      await reload();
      return data as GlobalBlock;
    },
    [reload],
  );

  const updateGlobal = useCallback(
    async (id: string, patch: Partial<Omit<GlobalBlock, "id">>) => {
      const { error } = await (supabase.from as any)("email_global_blocks")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  const deleteGlobal = useCallback(
    async (id: string) => {
      const { error } = await (supabase.from as any)("email_global_blocks")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  const value: Ctx = {
    globals,
    globalsMap,
    loading,
    error,
    reload,
    saveAsGlobal,
    updateGlobal,
    deleteGlobal,
  };

  return (
    <EmailGlobalBlocksContext.Provider value={value}>
      {children}
    </EmailGlobalBlocksContext.Provider>
  );
}
