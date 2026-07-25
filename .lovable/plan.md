
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

## Onda 1 — EmailTemplateEditor.tsx (2243 linhas)

**PR-A: extrair painéis de propriedades**
- Novo diretório `src/components/admin/emailTemplateEditor/`
- Mover `BlockPropsPanel` (linhas ~1054-2102) → `BlockPropsPanel.tsx`
- Mover `GlobalRefPropsPanel` (linhas ~2103-fim) → `GlobalRefPropsPanel.tsx`
- Mover controles reutilizados (`AlignControl`, `ColorControl`, `SortableRow`) → `controls.tsx`
- Estimativa: editor cai para ~600 linhas.

**PR-B (se necessário): extrair presets + defaults**
- Mover `defaultForKind` e helpers de preset para `blockDefaults.ts`.

---

## Onda 2 — EmailConfig.tsx (1901 → 1450 linhas, alvo <900)

Já foi parcialmente feita antes (HistoryTab, AutomationsTab, ConfigTab, useEmailAutomation).

**PR-A — ✅ CONCLUÍDO**
- Extrair a aba "Envio manual" (`batch`) para `src/components/admin/emailConfig/ManualSendTab.tsx`.
- Mover `dispatchBatch`/`scheduleBatch` para `src/components/admin/emailConfig/useEmailDispatch.ts`.
- Atualizar testes de regressão R-008 e R-023 para apontar para os novos arquivos.
- Validado: `npx tsc --noEmit`, `npm run lint`, `npm test` (85 arquivos / 381 tests) verdes.

**PR-B — PENDENTE (próxima onda segura)**
- Ainda restam na página as abas de **Template (marca)** e **Editor + Preview**, mantendo `EmailConfig.tsx` com 1450 linhas (acima do limite de 1000).
- Opções para PR-B:
  1. Extrair aba "Template (marca)" para `TemplateBrandTab.tsx`.
  2. Extrair aba "Editor + Preview" para `TemplateEditorTab.tsx`.
  3. Extrair query central de eventos ativos para `useEmailActiveEvents.ts` (reutilizável nos selects da aba manual e de automações).
- Recomendação: começar pela aba "Template (marca)" (self-contained, sem dependências de estado complexas).

---

## Onda 3 — EventForm.tsx (1602 linhas)

**PR-A: extrair secções do formulário**
- Novo diretório `src/components/events/eventForm/`
- Secções sugeridas: `BasicInfoSection.tsx`, `DateTimeSection.tsx`, `LocationSection.tsx`, `LineupSection.tsx`, `TicketSection.tsx`, `MediaSection.tsx`.

**PR-B: extrair schema + submit**
- Mover schema Zod e `handleSubmit` para `useEventForm.ts`.

---

## Onda 4 — EgressMonitor.tsx (1272 linhas)

**PR-A: extrair cards e gráficos**
- Novo diretório `src/pages/admin/egressMonitor/`
- Cards de resumo, tabela de alertas e gráficos em arquivos separados.

**PR-B: extrair queries**
- Consolidar fetchs num hook `useEgressData.ts`.

---

## Onda 5 — supabase/functions/_shared/emailBlocks.ts (1243 linhas)

**Atenção:** arquivo `_shared` — testar bundling depois.

**PR-A: dividir por família de bloco**
- Novo diretório `supabase/functions/_shared/emailBlocks/`
- Um arquivo por família (`hero.ts`, `event.ts`, `countdown.ts`, `dedge.ts`, `weekend.ts`, `article.ts`, `footer.ts`) + `index.ts` reexportando tudo.
- Manter API pública idêntica.

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

## Onda 8 — LinksManager.tsx (1060 linhas)

**PR-A: extrair listagem e modais**
- Extrair tabela de links, modal de edição e modal de reordenação para `src/pages/admin/linksManager/`.

**PR-B:** sem necessidade prevista (só se ainda passar de 900 linhas).

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
