/**
 * Hook para gerenciar a biblioteca de blocos globais de e-mail (Fase C).
 * Fornece lista live-synced e helpers de save/update/delete.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Block, GlobalBlock } from "@/lib/emailTemplates/blocks";

export function useEmailGlobalBlocks() {
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

  // Map para lookup rápido (usado pelo renderer)
  const globalsMap = new Map<string, GlobalBlock>(globals.map((g) => [g.id, g]));

  const saveAsGlobal = useCallback(
    async (block: Block, meta: { name: string; description?: string; category?: string }): Promise<GlobalBlock | null> => {
      if (block.kind === "global_ref") {
        throw new Error("Não é possível salvar uma referência como bloco global (evitando loops).");
      }
      // Remove o id local do bloco antes de salvar para evitar colisões
      const { id: _localId, ...rest } = block as any;
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

  return { globals, globalsMap, loading, error, reload, saveAsGlobal, updateGlobal, deleteGlobal };
}
