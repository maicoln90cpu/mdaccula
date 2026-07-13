# Architecture Quality — Plano aprovado (faseado)

Aprovado pelo usuário para atacar todas as fases nas ondas sugeridas. Começar por Fase A.

## Fase A — Higiene rápida (EM ANDAMENTO)
- **A1.** `useAuth.signOut` limpa cache do TanStack Query (`queryClient.clear()`) antes/depois do `supabase.auth.signOut()`. Extrair `queryClient` para `src/lib/queryClient.ts` (singleton exportável).
- **A2.** Substituir `console.*` por `logger.*` nos arquivos com mais ocorrências (não em testes):
  - `src/components/events/EventForm.tsx` (30)
  - `src/pages/admin/AIContent2.tsx` (11)
  - `src/components/admin/MergeEventsDialog.tsx` (10)
  - `src/pages/admin/BlogManager.tsx` (6)
  - `src/pages/admin/AutoGenerationDashboard.tsx` (6)
  - `src/pages/admin/EventsManager.tsx` (5)
  - `src/hooks/useAuth.tsx` (2)
- **A3.** Teste garantindo que `signOut` chama `queryClient.clear()`.

## Fase B — Deduplicar blocos de e-mail
- **B1.** Extrair constantes/limites compartilhados (`MAX_BLOG_POSTS`, `DEFAULT_MAX_ITEMS` etc.) para um único módulo, importado por `src/lib/emailTemplates/blocks.ts` **e** `supabase/functions/_shared/emailBlocks.ts`. Adicionar teste de contrato comparando limites.
- **B2 (futuro).** Consolidar renderizador de blocos num módulo TS puro único.

## Fase C — Slim-down `EmailConfig.tsx` (2.567 → ~6 arquivos)
- ✅ `SendNowButton.tsx`, `AbTestButton.tsx`, `HistoryTab.tsx`, `AutomationsTab.tsx`, `ConfigTab.tsx`
- Pendentes: `hooks/useEmailAutomation.ts` (opcional, para tirar handlers do pai).
- Sem mudança de comportamento.

## Fase D — Race conditions em buscas admin
- `AbortController` onde há `useEffect` cru + debounce: `pages/Search.tsx`, `admin/EventsManager.tsx`, `admin/LinksManager.tsx`, `admin/BlogManager.tsx`.
- Filtrar `AbortError` para não poluir logs.

## Fase E — Slim-down `EventForm.tsx` e `LinksManager.tsx` (futuro)
- Mesma técnica da Fase C.

## Prevenção de regressão
- A3: teste do logout limpando cache.
- B1: teste de divergência de limites entre frontend e edge.
- C: smoke tests das abas + teste de contrato existente (`email-personal-control.test.ts`).

## Autoevolução candidata
"Quando existe a mesma regra em frontend e edge function, criar módulo de constantes compartilhado + teste de divergência." Aguardando aprovação para incorporar à skill.
