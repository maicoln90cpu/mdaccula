## Suas dúvidas — respostas diretas

**1) Existe relação entre bloco DEDGE e bloco Agenda?**
Sim, hoje eles se sobrepõem. Nas edge functions `weekly-digest-draft` e `weekend-agenda-draft`, os eventos DEDGE são **injetados na mesma lista `weekendEvents`** que alimenta o bloco "Agenda do fim de semana" (`weekend_grid`). Por isso, quando você oculta o `dedge_block`, o DEDGE continua aparecendo — está sendo renderizado pelo bloco Agenda.

**2) Editor x Preview — dá para unificar?**
Sim, totalmente viável. O `EmailTemplateEditor` já tem preview embutido; a aba "Preview" só adiciona controles extras (trocar fonte: evento / digest / agenda FDS, carregar evento real). Dá para mover esses controles para o topo do editor e eliminar a aba Preview.

---

## Plano — 3 etapas independentes

### Etapa 1 — Separar DEDGE da Agenda (backend + frontend)
**Objetivo:** DEDGE só aparece via `dedge_block`. Agenda só mostra eventos não-DEDGE.

- Em `supabase/functions/weekly-digest-draft/index.ts` e `weekend-agenda-draft/index.ts`: separar os eventos DEDGE em `event.dedge` (já existe) e **remover DEDGE de `weekendEvents`**.
- Em `src/lib/emailTemplates/blocks.ts` (`case "weekend_grid"`): filtro defensivo `list.filter(ev => !isDedgeVenue(ev.venue))` como cinto+suspensório.
- Extrair helper `isDedgeVenue` para `supabase/functions/_shared/` (já existe inline) para garantir consistência dos dois lados.

**Antes:** Ocultar `dedge_block` no digest não remove DEDGE (aparece via Agenda).
**Depois:** `dedge_block` visível/oculto controla 100% do DEDGE. Agenda só mostra Nostalgia, Moving, Nave, etc.

**Vantagens:** Comportamento previsível, mental model simples ("cada bloco = 1 responsabilidade").
**Desvantagem:** Se você remover `dedge_block` de um template por engano, o DEDGE some do e-mail — mas fica claro no editor (bloco listado).

**Regressão prevenida (teste novo):**
- Vitest: `renderBlock('weekend_grid', ...)` com lista contendo DEDGE → HTML NÃO contém a linha DEDGE.
- Vitest: `renderBlock('dedge_block', hidden:true)` → retorna string vazia (guard `block.hidden`).

---

### Etapa 2 — Unificar aba "Editor de blocos" + aba "Preview"
**Objetivo:** 1 aba só, editor à esquerda + preview inline à direita, com controles de fonte no topo.

- Em `src/pages/admin/EmailConfig.tsx`:
  - Remover `TabsTrigger value="preview"` e o `TabsContent` correspondente.
  - Passar como novas props ao `EmailTemplateEditor`: `previewSource`, `setPreviewSource`, `loadDigestPreview`, `previewData`, `setPreviewData`, lista de eventos reais para o dropdown "carregar evento real".
- Em `src/components/admin/EmailTemplateEditor.tsx`:
  - Adicionar barra de contexto no topo do preview embutido: seletor "Fonte do preview" (Evento / Digest semanal / Agenda FDS) + dropdown "Carregar dados reais" (últimos eventos).
  - Manter todos os controles atuais do editor (drag/drop, propriedades, presets).

**Antes:** 2 abas com estado separado; trocar de aba perde contexto; preview do editor é limitado (só `previewData` mock).
**Depois:** 1 aba, preview reflete 100% o template real (com dados de digest/weekend inclusive), controles no mesmo lugar.

**Vantagens:** Menos duplicação de código (`previewHtml` calculado 1x), UX mais rápida, menos pontos de correção.
**Desvantagens:** Componente `EmailTemplateEditor` fica maior (~+100 linhas). Mitigação: extrair `<PreviewSourceBar>` como subcomponente.

**Regressão prevenida (teste novo):**
- Vitest: componente `EmailTemplateEditor` monta sem crashar quando recebe `previewSource="digest"`.

---

### Etapa 3 — Testes pendentes (5.b do ciclo anterior, agora fatiado)
Adicionar em `src/__tests__/`:

1. `lib/blocks-hidden.test.ts` — `renderBlockedTemplate` pula blocos com `hidden:true`.
2. `lib/blocks-dedge-multi-cta.test.ts` — `dedge_block` com N noites gera N botões, cada um com URL própria.
3. `lib/blocks-weekend-grid-no-dedge.test.ts` — Etapa 1: `weekend_grid` filtra DEDGE.
4. `lib/blocks-countdown-medium.test.ts` — "Médio" mostra "hora"/"min" (não "dias").
5. `hooks/useAuth-token-refresh.test.ts` — `onAuthStateChange('TOKEN_REFRESHED', sameSession)` NÃO recria `user` (previne regressão da aba resetando).

**Vantagens:** Trava permanente contra os bugs corrigidos nas últimas rodadas.
**Desvantagem:** Custo de manutenção mínimo — todos são testes de função pura, sem mocks pesados.

---

## Ordem sugerida de execução

**Rodada única (baixo risco, independentes):** Etapa 1 → Etapa 3 → Etapa 2.

- Etapa 1 primeiro porque muda comportamento visível (você valida no preview).
- Etapa 3 logo depois trava as regressões.
- Etapa 2 por último — mudança maior de UI, mas cosmética; se algo der errado, é rollback simples.

## Pendências fora deste plano (permanecem para depois)
- 5.a Google Maps
- 5.c Contract tests `weekly-digest-draft` / `weekend-agenda-draft`
- 5.d Alertas de egress
- Blocos globais compartilhados entre templates (Fase C dedicada, se aprovar)

## Detalhes técnicos (para referência)

```text
Etapa 1 — fluxo de dados atualizado
────────────────────────────────────
edge-fn → payload {
  weekendEvents: [ ...NÃO-DEDGE apenas ],
  dedge: { imageUrl, nights: [...4 noites], primaryUrl, ... }
}
                    │                                │
                    ▼                                ▼
            weekend_grid                       dedge_block
         (Nostalgia, Moving...)          (Dedge Moving/Nave/etc)
```

Confirma seguir por essa ordem (1 → 3 → 2)?
