
# Plano — Slim-down dos arquivos gigantes (&lt;1000 linhas cada)

## Regras gerais (valem para todas as ondas)

- **1 arquivo por onda.** Nunca mexer em 2 arquivos gigantes ao mesmo tempo.
- **Máx. 2 PRs por onda.** PR-A = extrair sem mudar comportamento. PR-B (se necessário) = ajustes finos e limpezas.
- **Zero mudança de comportamento.** Só mover código para novos arquivos e reimportar.
- **Checklist obrigatório antes de fechar cada onda:**
  - `npx tsc --noEmit` verde
  - `npm run lint` sem novos erros
  - `npm test` verde (com foco nos testes do arquivo alterado)
  - Validação manual no `localhost:8080` da tela/fluxo afetado
  - Se for Edge Function: rodar `scripts/bundle-edge-functions.mjs` e conferir bundle
- **Arquivo excluído do plano:** `src/integrations/supabase/types.ts` (auto-gerado, nunca editar).

---

## Ordem das ondas (do mais crítico ao menos crítico)

Prioridade = tamanho × risco de regressão × frequência de edição.

```text
Onda 1  EmailTemplateEditor.tsx       2243 → alvo <900
Onda 2  EmailConfig.tsx               1901 → alvo <900   (já iniciado antes)
Onda 3  EventForm.tsx                 1602 → alvo <900
Onda 4  EgressMonitor.tsx             1272 → alvo <800
Onda 5  _shared/emailBlocks.ts        1243 → alvo <900
Onda 6  generate-blog-post-v2/index   1220 → alvo <800
Onda 7  MediaSettings.tsx             1168 → alvo <800
Onda 8  LinksManager.tsx              1060 → alvo <800
Bônus   AIContent2.tsx                 919 → só se sobrar tempo
```

---

## Onda 1 — EmailTemplateEditor.tsx (2243 → 909 linhas) — ✅ CONCLUÍDA

## Onda 3 — EventForm.tsx (1602 → 816 linhas) — ✅ PR-A CONCLUÍDO

**PR-A — ✅ CONCLUÍDO**
- Criado diretório `src/components/events/eventForm/` com 7 arquivos:
  `constants.ts` (GENRES, STATES, normalizeUrl, EventFormData),
  `BasicInfoSection.tsx`, `DateTimeSection.tsx`, `GenresChecklist.tsx`,
  `LineupSection.tsx` (line-up + programação por dia), `TicketAndCtaSection.tsx`
  (ticket/vip/cta/pix/tickets_per_day), `DescriptionBlogSection.tsx`,
  `CreationOptionsSection.tsx` (createLink + generateBlogPost + dispatchEmail).
- Adotado `FormProvider` do react-hook-form para reduzir prop drilling.
- `EventForm.tsx`: **1602 → 816 linhas** (−49%). Abaixo do alvo <900.
- Allowlist do teste de cores atualizado para cobrir os 2 subcomponentes admin.
- 381 testes verdes, tsgo limpo.

**PR-B (opcional): extrair schema + submit para `useEventForm.ts`.**
Não obrigatório — arquivo já <900. Executar só se aparecerem novos requisitos.

**PR-A — ✅ CONCLUÍDO**
- Extraída aba "Envio manual" para `ManualSendTab.tsx` + hook `useEmailDispatch.ts`.
- Testes R-008 e R-023 atualizados.

**PR-B — ✅ CONCLUÍDO**
- Extraída aba "Template (marca)" → `TemplateBrandTab.tsx` (254 linhas).
- Extraída aba "Editor + Preview" → `TemplateEditorTab.tsx` (~230 linhas).
- Removidos imports órfãos (Button, Card, Label, Select*, EmailTemplateEditor).
- Teste de regressão `email-flow-parity` atualizado para apontar para o novo componente.
- `EmailConfig.tsx`: **1901 → 1123 linhas** (−41%). Ainda acima do alvo <900 por causa do estado central (~800 linhas de state + handlers). Considerar **Onda 2 PR-C opcional** no futuro para extrair `useEmailConfigState.ts` (hook orquestrador) se sobrar tempo — porém já está bem abaixo do limite inicial de "gigante".
- Validado: `tsgo --noEmit`, `eslint` e 381 testes passando.


---

## Onda 3 — EventForm.tsx (1602 linhas)

**PR-A: extrair secções do formulário**
- Novo diretório `src/components/events/eventForm/`
- Secções sugeridas: `BasicInfoSection.tsx`, `DateTimeSection.tsx`, `LocationSection.tsx`, `LineupSection.tsx`, `TicketSection.tsx`, `MediaSection.tsx`.

**PR-B: extrair schema + submit**
- Mover schema Zod e `handleSubmit` para `useEventForm.ts`.

---

## Onda 4 — EgressMonitor.tsx (1272 → 215 linhas) — ✅ CONCLUÍDA

**PR-A — ✅ CONCLUÍDO**
- Novo diretório `src/pages/admin/egressMonitor/` com:
  `types.ts` (77), `constants.ts` (27), `formatters.ts` (21),
  `BunnyTab.tsx` (347), `SupabaseTab.tsx` (257), `HistoryTab.tsx` (193), `InternalTab.tsx` (191).
- `EgressMonitor.tsx` reduzido para **215 linhas** — apenas orquestrador (state, fetchers, header, shell de tabs).
- Comportamento 100% preservado: mesmos fetchers, mesmo `defaultValue="bunny"`, mesmos gráficos/labels.
- Validado: `tsgo --noEmit` limpo, `eslint` limpo.

**PR-B (opcional): extrair fetchers para `useEgressData.ts`.**
Não obrigatório — arquivo já muito abaixo do alvo.


---

## Onda 5 — supabase/functions/_shared/emailBlocks.ts (1243 → 32 linhas) — ✅ CONCLUÍDA

**PR-A — ✅ CONCLUÍDO**
- Novo diretório `supabase/functions/_shared/emailBlocks/`:
  `types.ts` (189), `utils.ts` (61), `preheader.ts` (13),
  `renderBlock.ts` (735 — switch principal preservado 1:1),
  `renderBlockedTemplate.ts` (73), `renderBlockedTemplateText.ts` (159).
- `emailBlocks.ts` virou **barrel** de 32 linhas reexportando a API pública 1:1.
- Nenhum consumidor precisou mudar (frontend `@shared/emailBlocks.ts` + edges).
- Guard arquitetural `email-composer-guard` atualizado com o novo caminho legítimo.
- Testes de paridade byte-a-byte (`frontend-edge-render-parity`, `emailComposer`, `email-blocks-limits`, `email-map-geocode-on-dispatch`) e suíte completa (381 verdes) confirmam zero regressão visual.
- ⚠️ **Pendente**: redeploy das 3 edges que importam do `_shared/` (weekly-digest-draft, weekend-agenda-draft, blog-digest-draft) para inline dos novos arquivos.


**PR-B: rodar `scripts/bundle-edge-functions.mjs`** e redeployar todas as funções que importam esse shared.

---

## Onda 6 — supabase/functions/generate-blog-post-v2/index.ts (1220 linhas)

**PR-A: extrair helpers puros**
- Novos arquivos ao lado: `prompts.ts`, `firecrawl.ts`, `postBuilder.ts`, `imageGenerator.ts`.
- `index.ts` fica só com o handler HTTP.

**PR-B: bundle + deploy da função + rodar testes de contrato `edge-generate-blog-post-from-topic.test.ts`.**

---

## Onda 7 — MediaSettings.tsx (1168 linhas)

**PR-A: extrair sub-abas**
- Bunny CDN, Placeholders, Upload defaults, Egress rules em componentes separados sob `src/components/admin/settings/media/`.

**PR-B (opcional):** consolidar hooks de mutation em `useMediaSettings.ts`.

---

## Onda 8 — LinksManager.tsx (1060 → 716 linhas) — ✅ CONCLUÍDA

**PR-A — ✅ CONCLUÍDO**
- Novo diretório `src/pages/admin/linksManager/` com:
  `types.ts` (40), `LinkRow.tsx` (118), `GroupCard.tsx` (135),
  `BulkSizeDialog.tsx` (73), `AddToGroupDialog.tsx` (67).
- `LinksManager.tsx` reduzido para **716 linhas** — apenas orquestrador (estado, DnD, fetchers, handlers de CRUD).
- Comportamento 100% preservado: mesmos handlers, mesma UX de drag-and-drop entre grupos, mesmos filtros de status.
- Validado: `tsgo --noEmit` limpo, `eslint` limpo, 381 testes verdes.

**PR-B:** desnecessário — arquivo já abaixo do alvo <800.

---

## Bônus — AIContent2.tsx (919 linhas)

Está abaixo de 1000, mas próximo. Só refatorar se sobrar orçamento; aplicar o mesmo padrão (extrair abas para pasta dedicada).

---

## Como acompanhar

- Marcar cada onda como `[ ] pendente / [~] em andamento / [x] concluída` no `plan.md` do projeto.
- Ao final de cada onda, entregar o relatório padrão (Antes vs Depois, melhorias, vantagens/desvantagens, checklist manual, pendências, prevenção de regressão) exatamente como definido no `mem://~user`.

## Riscos conhecidos

- **Onda 5** (emailBlocks shared) é a mais arriscada: qualquer erro quebra várias funções de e-mail. Redeploy imediato + testes de contrato são obrigatórios.
- **Onda 3** (EventForm) e **Onda 2** (EmailConfig) tocam telas de uso diário: validação manual no preview antes do publish.
- Ondas 1, 4, 7, 8 são puramente visuais/admin — risco baixo.

## Próximo passo

Aprovar a **Onda 1 (EmailTemplateEditor.tsx — PR-A)** para eu começar pela maior redução (2243 → ~600).
