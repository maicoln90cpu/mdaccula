/**
 * TanStack Query client singleton.
 *
 * Exportado como módulo para permitir invalidação/limpeza fora de componentes
 * (ex.: `queryClient.clear()` em `useAuth.signOut`), evitando vazamento de
 * cache entre sessões de usuário.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});
