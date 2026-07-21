## Plano — 3 correções na gestão de e-mail e mesclagem

### 1) Envio manual: aviso não-bloqueante em vez de erro

**Hoje:** em `src/lib/emailTemplates/dispatchEventDraft.ts` (linha 218), qualquer `composition.issues` (ex.: `ARTICLE_MISSING` — "Vincule uma matéria ao evento ou oculte o resumo.") aborta o envio com `ok:false`.

**Depois:** classificar as issues em duas categorias:
- **Bloqueantes** (permanecem impedindo o envio): faltar template, faltar bloco obrigatório, etc.
- **Avisos** (permitem envio, mas retornam mensagem visível): `ARTICLE_MISSING`.

Implementação:
- Adicionar constante `WARNING_ISSUE_CODES = new Set(['ARTICLE_MISSING'])` em `dispatchEventDraft.ts`.
- Filtrar `composition.issues`; se houver só warnings, seguir com o envio e retornar `{ ok: true, warnings: [...] }`.
- Estender `DispatchEventDraftResult` com campo opcional `warnings?: EmailCompositionIssue[]`.
- Nos consumidores (envio manual em `EmailConfig.tsx` e `EmailEventsTab.tsx`), quando `result.ok && result.warnings?.length`, mostrar toast **amarelo** com a mensagem, sem impedir a operação.

### 2) Evento mesclado ainda mostra nome antigo em /eventos

**Diagnóstico confirmado:** o `title` é atualizado corretamente no banco (linha 199 de `MergeEventsDialog.tsx`). O nome antigo persiste porque:
- `useEvents` grava `mdaccula-events-cache` em `localStorage` (30 min de staleTime) e usa como `placeholderData`.
- O Service Worker (`public/service-worker.js`) pode manter respostas antigas do Supabase em cache.
- A página `/eventos` não é notificada quando a mesclagem acontece em outra aba (admin).

**Correção:**
- Ao final do `handleMerge` em `MergeEventsDialog.tsx`, além do `onSuccess()`, executar:
  - `localStorage.removeItem('mdaccula-events-cache')`
  - Notificar o SW via `postMessage({ type: 'CLEAR_EVENTS_CACHE' })` (adicionar handler simples no `service-worker.js` que dá `caches.delete` nas entradas de eventos).
  - `queryClient.invalidateQueries({ queryKey: ['events'] })` — injetar `useQueryClient` no dialog.
- No `useEvents.ts`, adicionar `refetchOnMount: 'always'` quando o cache local for mais antigo que 5 min OU quando a chave de cache tiver um marcador de "invalidado".

Escopo mínimo suficiente na maioria dos casos: limpar `localStorage` + invalidar query. O SW só é problema se o usuário tiver a página aberta há muito tempo — tratar em fallback.

### 3) Selects de e-mail: mostrar apenas eventos ativos

**Hoje:** em `src/pages/admin/EmailConfig.tsx` (linhas 195-207) a query filtra `.neq('status','merged_inactive')` e mantém últimos 7 dias.

**Depois:**
- Trocar por `.eq('status', 'active')` (elimina `merged_inactive`, `draft`, `archived`, etc. — só ativos).
- Remover a janela de -7 dias: passar a filtrar `.gte('date', hoje)`.
- Manter ordenação crescente e limite 500.
- Aplicar o mesmo padrão no select "real event" do preview (mesmo arquivo) — a query já é a mesma, então é uma alteração única.
- Verificar se `EmailEventsTab.tsx` (linhas 205-211) usa a mesma query para o dropdown de envio ou é só para a tabela de histórico; se for para dropdown, aplicar o mesmo filtro.

---

### Detalhes técnicos

- Arquivos alterados: `src/lib/emailTemplates/dispatchEventDraft.ts`, `src/pages/admin/EmailConfig.tsx`, `src/components/admin/emailConfig/EmailEventsTab.tsx`, `src/components/admin/MergeEventsDialog.tsx`, `src/hooks/useEvents.ts`, opcionalmente `public/service-worker.js`.
- Nenhuma mudança de schema, nenhuma edge function tocada.
- Nenhum teste existente deve quebrar; adicionar 1 teste em `src/__tests__/lib/` cobrindo a classificação warning-vs-blocker em `dispatchEventDraft`.

### Antes vs Depois (resumo)

| Item | Antes | Depois |
|---|---|---|
| Envio manual sem matéria | Erro bloqueia | Aviso amarelo, envio segue |
| Nome do festival mesclado | Mochakk (cache antigo) | Nome renomeado aparece imediatamente |
| Select de eventos | Ativos + inativos recentes | Só ativos futuros |

### Riscos / trade-offs

- Envio manual sem matéria pode gerar e-mail com bloco `article_summary` vazio — o composer já trata como bloco oculto, então visual fica ok.
- Filtro `status='active'` esconde `merged_inactive` e qualquer outro status não-ativo. Se no futuro criarmos status `draft`, também some do select (comportamento desejado).
- Limpar `localStorage` do cache de eventos custa 1 requisição extra por usuário quando a página /eventos abrir depois de uma mesclagem — irrelevante.

### Checklist manual (após aprovado)

- [ ] Envio manual num evento sem matéria vinculada mostra toast amarelo mas envia.
- [ ] Envio manual num evento com template inválido continua bloqueando.
- [ ] Mesclar 2+ eventos com nome custom → abrir /eventos em outra aba → nome novo aparece.
- [ ] Selects da aba E-mail não mostram nenhum evento com data passada nem mesclado.
