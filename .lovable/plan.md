## Contexto

Duas frentes independentes neste passo:

**A. Bugs críticos no render de e-mail (backend)**
Investiguei o pipeline e achei duas causas-raiz que explicam o print do preview do Digest com blocos "OCULTO" ainda aparecendo:

1. `supabase/functions/_shared/emailBlocks.ts` → função `renderBlock` **NÃO checa `block.hidden`**. O frontend (`src/lib/emailTemplates/blocks.ts` linha 264) checa; o backend não. Como o preview do Digest/Agenda FDS é renderizado pela edge function `weekly-digest-draft`, blocos ocultos vazam no preview E nos envios reais (digest, agenda FDS e campanha de evento novo, todos usam esse shared).
2. O mesmo arquivo backend **não expande `global_ref`**. Blocos globais em envios reais renderizam vazio/quebrado (bug irmão do "Bloco global indisponível" já corrigido no front).

**B. Template de Cortesia — reescrever**
Hoje o preset tem placeholders `{{guest_name}}` e `{{courtesy_link}}` (nominal). Você quer: template genérico, mesma estrutura do "Novo evento", copy com senso de escassez/oportunidade ("poucas cortesias disponíveis", "primeira chegada, primeira retirada", etc.), sem personalização por convidado.

---

## Plano por etapas seguras

### Etapa 1 — Corrigir render no backend (bug do preview e dos envios)

Arquivo: `supabase/functions/_shared/emailBlocks.ts`
- Adicionar `if ((block as any).hidden) return "";` no topo de `renderBlock` (paridade 1:1 com o front).
- Adicionar função `expandGlobalRefs` (copiada do front) e chamar em `renderBlockedTemplate` antes do `.map(renderBlock)`.
- Aceitar `globals` no `opts` de `renderBlockedTemplate`.

Arquivos consumidores para passar `globals`:
- `supabase/functions/weekly-digest-draft/index.ts`
- `supabase/functions/weekend-agenda-draft/index.ts`
- `supabase/functions/create-event-email-campaign/index.ts`

Cada um passa a carregar `email_global_blocks` do banco e injetar no render.

Redeploy das 3 edge functions.

### Etapa 2 — Testes automatizados de regressão (backend)

Novo arquivo: `supabase/functions/_shared/emailBlocks_test.ts` (Deno.test) cobrindo bloco a bloco:
1. `hidden: true` em cada `kind` (header, hero_image, event_meta, static_map, cta_button, social_icons, footer, text, divider, eyebrow, ticker, event_card, event_card_multi, article_card, article_grid, countdown, agenda_grid, dedge_multi_cta, global_ref) → render retorna string vazia para aquela linha.
2. `global_ref` sem `globals` no opts → render vazio; com global correspondente → renderiza o bloco resolvido; com global oculto → vazio.
3. Snapshot: template completo com metade dos blocos ocultos → HTML final não contém o texto/label dos ocultos.

Rodar via `supabase--test_edge_functions`.

Também um teste frontend em `src/__tests__/lib/blocks-hidden-parity.test.ts` garantindo que a lista de `kind` cobertos no front e no backend é a mesma (guard estático contra divergência futura).

### Etapa 3 — Auditoria do payload enviado ao E-goi

Somente leitura + relatório: inspecionar `create-event-email-campaign/index.ts` e listar em uma tabela no chat o que vai no payload (subject, from, html, text?, list_id, tags, contact fields, template_id, schedule). Marcar campos vazios/hardcoded que deveriam vir do template ativo. Sem alterar código — só reporto o diagnóstico para você aprovar ajustes.

### Etapa 4 — Reescrever o preset "Cortesia"

Arquivo: `src/lib/emailTemplates/blocks.ts`
- Substituir o case `courtesy` do preset builder por uma estrutura idêntica ao `event_new` (header + hero_image do flyer + eyebrow + title + subtitle + event_meta + description + static_map + cta_button "Retirar cortesia grátis" + divider + social_icons + footer).
- Copy do preset com gatilhos de escassez:
  - Eyebrow: `"CORTESIA · VAGAS LIMITADAS"`
  - Texto acima do CTA: `"Liberamos algumas cortesias para esse rolê — são poucas e por ordem de chegada. Garanta a sua agora, antes que acabem."`
  - Botão: `"Quero minha cortesia"`
  - Descrição extra: `"Cortesias sujeitas à disponibilidade na porta. Chegue cedo."`
- Sem `{{guest_name}}` / `{{courtesy_link}}`: link vai apontar para a página do evento (mesmo padrão do "Novo evento"). Nome do template genérico: `"Cortesia — evento (genérico)"`.
- Manter `template_type: "courtesy"` para caber no filtro por tipo já implementado.

Nenhuma migration nova (a migration da Etapa 4 anterior já liberou `courtesy` no CHECK).

### Etapa 5 — Validação manual (você faz depois do deploy da 1)

Checklist:
- [ ] Abrir Digest no editor, ocultar 3 blocos, clicar "Atualizar preview" → some do preview.
- [ ] Mesmo para Agenda FDS.
- [ ] Novo evento → disparar rascunho no E-goi → conferir que bloco oculto não vai no HTML.
- [ ] Salvar edição em bloco → recarregar → conteúdo persiste (já corrigido em fase anterior, revalidar).
- [ ] Criar template a partir do preset "Cortesia" → preview e HTML final ok.

### Fora deste plano (Fase 5 antiga)

A revisão dos templates antigos para reaproveitar novos blocos continua pendente — proponho fazer depois desta rodada, num plano separado.

---

## Antes vs Depois

- **Antes:** oculto funciona só no preview do evento; digest/FDS/envio real ignoram `hidden`; globais quebram em envio real; template de cortesia é nominal.
- **Depois:** paridade total front↔backend, oculto respeitado em preview e envio, globais expandidos no backend, template de cortesia genérico com copy de escassez, testes cobrindo bloco a bloco.

## Riscos

- Baixo: mudança é aditiva (`if hidden return ""`) e paralela ao front já testado.
- Médio: expansão de `global_ref` no backend depende de carregar `email_global_blocks` — se a query falhar, tratamos como "sem globals" (fallback silencioso, igual ao front).

## Prevenção de regressão

- Testes Deno bloco-a-bloco (Etapa 2).
- Guard de paridade front↔backend (mesma etapa).
- Já existentes: `blocks-hidden.test.ts` no front continuam válidos.

Aprova para eu executar da Etapa 1 até a 4? Se quiser fatiar (ex.: só a 1+2 primeiro para você validar o preview antes da cortesia), me diga.