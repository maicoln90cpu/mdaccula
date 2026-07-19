/**
 * Hook da biblioteca de blocos globais de e-mail.
 *
 * Historicamente era um hook local (cada componente com seu próprio cache).
 * Isso causou o bug "[Bloco global indisponível]" — dois caches distintos,
 * um salvava e o outro não sabia.
 *
 * Agora é um simples consumidor do contexto único `EmailGlobalBlocksProvider`
 * (definido em `@/contexts/EmailGlobalBlocksContext`). Fora do Provider, cai em
 * um fallback local (mantém compatibilidade com testes/isolados), mas dentro
 * do Provider TODOS os componentes compartilham o mesmo cache — evita o bug
 * do "[Bloco global indisponível]" no preview logo após salvar.
 */
import { useContext } from 'react';
import {
  EmailGlobalBlocksContext,
  type EmailGlobalBlocksCtx,
} from '@/contexts/emailGlobalBlocksContextValue';

export function useEmailGlobalBlocksContext(): EmailGlobalBlocksCtx {
  const ctx = useContext(EmailGlobalBlocksContext);
  if (ctx) return ctx;
  // Fallback silencioso: sem Provider, retorna cache vazio inerte.
  return {
    globals: [],
    globalsMap: new Map(),
    loading: false,
    error: null,
    reload: async () => {},
    saveAsGlobal: async () => {
      throw new Error('EmailGlobalBlocksProvider não montado — envolva a página com o Provider.');
    },
    updateGlobal: async () => {
      throw new Error('EmailGlobalBlocksProvider não montado.');
    },
    deleteGlobal: async () => {
      throw new Error('EmailGlobalBlocksProvider não montado.');
    },
  };
}

export { useEmailGlobalBlocksContext as useEmailGlobalBlocks };
