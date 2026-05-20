
# Fase 6 — Refinar mesclagem (textos, bug e soft-delete)

## Suas respostas confirmadas

1. ✅ Soft-delete aprovado (`status text` + `merged_into_id`). **E sim**, você poderá reativar pelo próprio admin (sem SQL).
2. ✅ Slug inativo → **301 para o principal**.
3. ✅ Entrega em 3 fases (6.1 → 6.2 → 6.3).

---

## Fase 6.1 — Correções imediatas (sem migração, risco baixo)

### A. Corrigir textos do `MergeEventsDialog`

**Arquivo:** `src/components/admin/MergeEventsDialog.tsx`

Tornar o passo "Repontar links de venda" **condicional ao toggle**:

- **Toggle DESLIGADO (link único):**
  > "Os links de venda dos N duplicados serão repontados para o evento principal — o botão **Comprar Ingresso** abrirá o link único do principal."

- **Toggle LIGADO (modal por dia):**
  > "Os links de venda de cada dia serão **preservados** e reassociados ao festival. O botão **Comprar Ingresso** abrirá o modal de seleção do dia, e cada dia abrirá o seu próprio link."

### B. Investigar bug "precisa atualizar para funcionar"

- Adicionar `console.log("[merge] step X")` em cada etapa do `handleMerge`.
- Adicionar `queryClient.invalidateQueries({ queryKey: ["events"] })` explícito no `onSuccess`.
- Travar o `Dialog` (`onOpenChange` ignorado) enquanto `merging = true`, para o realtime não desmontar o modal no meio.
- Pedir uma reprodução com console aberto se persistir.

### Antes vs depois (Fase 6.1)
| Antes | Depois |
|---|---|
| Texto do modal igual para os 2 modos → confunde | Texto adapta-se ao toggle |
| Confirmar exige refresh ocasional | Travamento + invalidação explícita |

### Riscos
- Zero no banco. Apenas UI/UX e logs.

### Checklist manual
- [ ] Toggle OFF → texto fala "link único do principal".
- [ ] Toggle ON → texto fala "preservados e modal por dia".
- [ ] Confirmar e mesclar funciona sem refresh, lista atualiza sozinha.

---

## Fase 6.2 — Soft-delete (migração + filtros)

### Migração

Adicionar à tabela `events`:
```sql
ALTER TABLE events
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN merged_into_id uuid REFERENCES events(id) ON DELETE SET NULL,
  ADD COLUMN merged_at timestamptz;

CREATE INDEX events_status_idx ON events (status);
CREATE INDEX events_active_date_idx ON events (date) WHERE status = 'active';
```

### Filtros `status = 'active'` (lista completa)

**Públicos:**
- `src/hooks/useEvents.ts`
- `src/pages/Eventos.tsx` (se houver query direta)
- `src/pages/Index.tsx` + `src/components/sections/FeaturedEvents.tsx`
- `src/components/events/EventsCarousel.tsx`
- `src/components/sections/Hero.tsx`
- `supabase/functions/sitemap/index.ts` (não indexar inativos)
- `supabase/functions/blog-rss/index.ts` (se listar eventos)

**Admin:**
- `src/pages/admin/EventsManager.tsx`
- `src/pages/admin/EventsDashboard.tsx`
- `src/components/admin/MultiEventArticleModal.tsx`

**EventDetail (`/eventos/{slug}`):**
- Se o slug aberto tem `status = 'merged_inactive'` → buscar `merged_into_id` → **301** para o slug do principal. Reaproveita lógica do `event_slug_redirects` (que continua existindo como fallback).

### Novo `handleMerge` em `MergeEventsDialog`

Substituir o `DELETE` final por:
```ts
await supabase.from("events").update({
  status: 'merged_inactive',
  merged_into_id: primary.id,
  merged_at: new Date().toISOString(),
}).in("id", duplicateIds);
```

### Novo `handleUndo` em `UndoMergeDialog`

Sem INSERT, sem snapshot, sem conflito de slug:
```ts
await supabase.from("events").update({
  status: 'active',
  merged_into_id: null,
  merged_at: null,
}).in("id", restoredIds);
```
+ restaurar `primary_pre_merge` + apagar redirects + repontar links de volta.

→ **Remover** toda a checagem `slugConflicts` (não é mais necessária).

### Antes vs depois (Fase 6.2)
| Antes | Depois |
|---|---|
| Mescla DELETA evento | Mescla INATIVA (mantém histórico) |
| Desfazer recria via INSERT, pode falhar por slug | Desfazer é só UPDATE — sempre funciona |
| Evento some do banco | Continua no banco, marcado `merged_inactive` |

### Riscos e mitigações
- **Risco principal**: esquecer um filtro `status = 'active'` em alguma listagem → evento mesclado aparece duplicado.
  - **Mitigação 1**: lista completa acima, revisada arquivo a arquivo.
  - **Mitigação 2**: teste automatizado novo (`events.list.filtersInactive.test.ts`) que mocka 1 ativo + 1 inativo e exige que `useEvents` retorne 1.
  - **Mitigação 3 (futura)**: criar view SQL `public_events` filtrada (Fase 6.3 opcional).

### Checklist manual
- [ ] Mesclar 2 eventos → duplicado some das listagens públicas e admin.
- [ ] `/eventos/{slug-do-inativo}` → redireciona 301 para o principal.
- [ ] Aba "Eventos Mesclados" → mostra mesclagem com botão Desfazer.
- [ ] Desfazer → evento volta a aparecer em todas as listagens (sem erro de slug).
- [ ] Listagem pública (`/eventos`) e home não mostram inativos.
- [ ] Sitemap não inclui inativos.
- [ ] `/links` (Linktree) intocado.

---

## Fase 6.3 — Reativação manual pelo admin (resposta à sua pergunta 1)

### O que vai mudar no `EventsManager`

- Adicionar **filtro "Mostrar mesclados (inativos)"** (checkbox no topo da lista).
- Quando ligado, lista também mostra eventos `merged_inactive`, com badge **"Mesclado em {evento principal}"**.
- Cada linha inativa ganha botão **"Reativar"** → executa o mesmo `UPDATE status='active', merged_into_id=null` (a mesma ação que o Desfazer faz, mas sem mexer no principal).

### Vantagem
Você pode, mesmo depois que a janela do "Eventos Mesclados" expirar (evento já passou), reativar um evento mesclado pelo admin sem precisar de SQL.

### Risco
- Se o evento principal foi muito alterado depois da mescla, a "reativação solta" pode gerar duplicidade visual no front (2 eventos no mesmo dia). Vamos mostrar um aviso antes de reativar.

### Checklist manual
- [ ] Filtro "Mostrar mesclados" lista os inativos.
- [ ] Botão Reativar volta o evento ao público.
- [ ] Reativar evento de festival já passado funciona.

---

## Prevenção de regressão (todas as fases)

- Novo teste: `MergeEventsDialog.softDelete.test.tsx` — verifica que `handleMerge` faz UPDATE (não DELETE) quando status existe.
- Novo teste: `useEvents.filtersInactive.test.ts` — garante que `status='active'` é aplicado.
- Atualizar memória do projeto: nova entrada `mem://features/event-soft-delete` documentando que TODA query nova em `events` precisa filtrar `status='active'` por padrão.

---

## Cronograma de deploy

1. **Fase 6.1** (hoje): textos + bug do refresh. Validar 1 dia.
2. **Fase 6.2** (após validar 6.1): migração + soft-delete + filtros. Validar 2-3 dias antes de continuar.
3. **Fase 6.3** (após validar 6.2): reativação manual no admin.

Confirma para eu começar pela Fase 6.1?
