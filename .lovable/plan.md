## Diagnóstico (o que descobri no seu banco)

Você **não** errou no cadastro. O evento Nostalgia está perfeito no banco:

- `date = 2026-07-09`
- `end_date = 2026-07-10` ✅
- `time = 20:00`
- `schedule` com as duas datas (09/07 e 10/07 às 20h) ✅
- `status = active`

O irmão `nostalgia0907` está com `merged_into_id` apontando para o principal (`nostalgia1007`) e `merged_at = 14/06/2026`. Mesclagem correta.

**O problema está em 3 lugares no código que ignoram `end_date`:**

---

### Bug 1 — Página `/eventos` esconde festival no dia final

Arquivo: `src/pages/Eventos.tsx` (linhas 216-222)

```ts
.filter(event => parseLocalDate(event.date) >= now)   // ← usa só date
```

Hoje é 10/07. `event.date = 09/07` → o filtro elimina o evento, mesmo com `end_date = 10/07`. É por isso que o Nostalgia sumiu da lista pública hoje.

O hook `useEvents` está correto (usa `isEventVisible` que já considera `end_date`), mas a página filtra de novo por cima e derruba o festival.

**Antes:** `event.date >= hoje` → festival some no último dia.
**Depois:** `(event.end_date ?? event.date) >= hoje` → festival aparece até o último dia.

---

### Bug 2 — Agenda FDS (edge `weekend-agenda-draft`) ignora `end_date`

Arquivo: `supabase/functions/weekend-agenda-draft/index.ts` (linhas 270-271)

```ts
.gte('date', startIso).lte('date', endIso)   // ← só date
```

Se o FDS for sex-dom (10-12/07) e o Nostalgia começou quinta 09/07, ele fica de fora — mesmo terminando na sexta.

**Depois:** buscar num range mais amplo e filtrar em memória:
`(date <= endIso) && ((end_date ?? date) >= startIso)`
(Range multi-dia sobrepõe a janela do FDS.)

---

### Bug 3 — Aba "Eventos Mesclados" vazia

Arquivo: `src/components/admin/MergedEventsTab.tsx`

A aba lê **`application_logs`** filtrando por `context.action = 'merge_events'`. Rodei `SELECT` — **não existe nenhum log de merge no banco**. Mesclagens antigas (como Nostalgia, feita em 14/06) foram executadas antes do logging existir, então ficam invisíveis por esse caminho.

A **fonte de verdade** é a tabela `events` (colunas `merged_into_id` e `merged_at`).

**Depois:** a aba passa a consultar `events` diretamente:
- lista todo evento com `merged_into_id IS NOT NULL` e `merged_at` recente
- agrupa pelo evento principal (o "pai")
- só mostra grupos cujo evento principal ainda não passou (usando `end_date ?? date`)
- para cada grupo, se existir log com snapshot em `application_logs`, o botão "Desfazer" fica ativo; senão, mostra "Mesclagem antiga sem snapshot — desfazer manualmente"

Assim o Nostalgia (e outros mesclados históricos) volta a aparecer, e novas mesclagens (com log) continuam com undo automático.

---

## Plano de execução (3 fases isoladas)

### Fase A — Corrigir listagem pública (Bug 1)
- Editar `getUpcomingEvents` em `src/pages/Eventos.tsx` para considerar `end_date`.
- Verificar rapidamente `EventsCarousel` e `FeaturedEvents` — pelo que vi já usam `end_date` para exibição, mas confirmo se algum filtro adicional também precisa ajuste.
- **Sem** mudança de banco. Sem mudança de UI. Só o filtro.

### Fase B — Corrigir Agenda FDS (Bug 2)
- Editar a query do `weekend-agenda-draft` para não excluir festivais que atravessam a janela.
- Redeploy automático da edge.

### Fase C — Corrigir aba "Eventos Mesclados" (Bug 3)
- Reescrever `MergedEventsTab` para ler `events` (fonte de verdade) em vez de `application_logs`.
- Manter `UndoMergeDialog` atual — só passa a receber os dados agrupados vindos de `events`.
- Botão "Desfazer" só habilitado se existir log com snapshot; caso contrário, mostra aviso.

---

## Checklist de validação (após cada fase)

**Fase A**
- [ ] Abrir `/eventos` hoje: Nostalgia aparece na lista.
- [ ] Abrir amanhã (11/07): Nostalgia some (end_date passou).
- [ ] Eventos de dia único continuam sumindo no dia seguinte como antes.

**Fase B**
- [ ] Gerar rascunho da Agenda FDS: Nostalgia aparece se a janela do FDS pegar 10/07.
- [ ] Eventos totalmente fora da janela continuam de fora.

**Fase C**
- [ ] Abrir Admin → Eventos → aba "Eventos Mesclados": Nostalgia aparece.
- [ ] Mesclagens de eventos que já passaram **não** aparecem (limpeza visual).
- [ ] Botão "Desfazer" aparece habilitado só quando há snapshot.

---

## Riscos e prevenção de regressão

- **Risco baixo em todas as fases**: só ampliam o que é considerado ativo/visível, não escondem nada que hoje aparece.
- Testes existentes em `eventDateHelper.test.ts` já cobrem multi-dia com `end_date` — vou adicionar um teste unitário para o novo filtro em `Eventos.tsx` e um para o filtro da edge FDS.
- **Sem migração de banco.** Zero mudança de schema.

## Pendências (não incluídas agora)
- Auditoria geral em todo o código atrás de outros `event.date >=` órfãos (existe em admin? em cron de recorrentes?). Se quiser, faço um segundo plano só para isso depois.

**Pergunta antes de começar:** posso ir na ordem A → B → C, executando **uma fase por vez** e esperando você validar antes de seguir para a próxima?