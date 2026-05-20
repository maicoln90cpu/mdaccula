## Plano — Fase 4

### Problema 1 — Itens excluídos não somem em /admin/links-manager
**Hipótese principal:** O DELETE acontece no banco (toast confirma), mas o evento realtime não dispara o `fetchGroups()` no cliente. Possíveis causas:
- Canal websocket não chega ao status `SUBSCRIBED` (silencioso hoje).
- O `useRealtimeTable` cria 2 canais separados (`custom_links` e `link_groups`) — em rajadas isso pode falhar uma das subscrições sem aviso.
- `REPLICA IDENTITY` da tabela é `DEFAULT` → no DELETE só vem o `id`, suficiente para invalidar mas exige RLS permissiva.

**Cloudflare:** descartado. APIs do Supabase não passam pelas suas regras de cache em `mdaccula.com/assets/*`.

**Ações:**
1. Trocar os 2 `useRealtimeTable` por **1 `useAdminRealtime(["custom_links","link_groups"])`** (já existe, criado na Fase 2) — um único canal, mais robusto.
2. Adicionar log de status (`SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT`) dentro do hook, em DEV apenas, para diagnosticar futuras falhas silenciosas.
3. **Fallback de segurança:** após o `await supabase.from("custom_links").delete()`, manter o `fetchGroups()` local (já existe) E também invalidar o cache do React Query (não tem aqui, mas o fetchGroups já cobre). Acrescentar **remoção otimista**: tirar o item do `setGroups` imediatamente, antes do refetch, para o usuário ver o efeito mesmo se o realtime falhar.
4. Garantir `ALTER TABLE custom_links REPLICA IDENTITY FULL` e `link_groups REPLICA IDENTITY FULL` via migration — para DELETE trazer payload completo (ajuda futuros filtros).

### Problema 2 — "Algo deu errado" ao navegar no preview
**Causa raiz confirmada nos logs:** chunks lazy-loaded (`Eventos-*.js`, `AdminLayout-*.js`) com hash antigo somem após novo deploy; o `import()` rejeita e o `ErrorBoundary` mostra tela de erro.

**Solução padrão (Vite + React lazy):**
1. **Listener global** em `src/main.tsx` para `window.addEventListener("vite:preloadError", ...)` que faz `window.location.reload()` uma única vez (usar sessionStorage para evitar loop).
2. Listener adicional para `unhandledrejection` capturando mensagens contendo "dynamically imported module" / "Failed to fetch dynamically imported" → mesmo reload guarded.
3. No `ErrorBoundary.componentDidCatch`, se a mensagem casar o padrão de chunk obsoleto, disparar o mesmo reload guarded em vez de mostrar a tela de erro.
4. Guard: chave `__chunk_reload_at` em `sessionStorage` — só recarrega se passou mais de 10s da última tentativa. Evita loop infinito caso o chunk realmente esteja quebrado (não só obsoleto).

### Arquivos afetados
- `src/pages/admin/LinksManager.tsx` — trocar hooks, adicionar update otimista no delete.
- `src/hooks/useAdminRealtime.ts` — adicionar log de status em DEV.
- `src/main.tsx` — listener global `vite:preloadError` + `unhandledrejection`.
- `src/components/ErrorBoundary.tsx` — detectar erro de chunk e auto-reload guarded.
- Nova migration: `REPLICA IDENTITY FULL` em `custom_links` e `link_groups`.

### Formato de resposta (após implementar)
1. **Antes vs Depois** — comportamento do delete e do erro de navegação.
2. **Melhorias** — realtime unificado, auto-recuperação de deploy novo.
3. **Vantagens / desvantagens** — pró: UX sem travar; contra: 1 reload extra silencioso ao publicar uma nova versão com a aba aberta.
4. **Checklist manual:**
   - Excluir um link em /admin/links-manager → some imediatamente (otimista) e fica fora após refetch.
   - Abrir 2 abas /admin/links-manager → excluir em uma → some na outra em até 1s.
   - Publicar nova versão com aba aberta → navegar → recarrega sozinho sem mostrar "Algo deu errado".
5. **Pendências** — nenhuma; opcional futuro: substituir `fetchGroups` por React Query no LinksManager (alinhamento com Links público).
6. **Prevenção de regressão** — teste no `useAdminRealtime` para o caso de array de tabelas; teste no ErrorBoundary garantindo que erro de chunk dispara reload e erro comum mostra UI.

Posso implementar?