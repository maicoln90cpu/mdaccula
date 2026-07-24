# Template de e-mail multi-evento (grid) para "Virada de Lote" — Design

**Data:** 24/07/2026
**Status:** aprovado pelo usuário, aguardando plano de implementação

## Contexto

O template "Virada de lote" hoje é sempre sobre **1 evento**: um flyer grande, título, CTA de
ingresso. Em dias que mais de um evento vira de lote ao mesmo tempo, o admin manda um e-mail
separado por evento — o usuário quer **um e-mail só**, com os eventos lado a lado em formato
grid (2 por fileira), em vez de vários e-mails "flyer enorme de 1 evento só".

Isso é fundamentalmente diferente do template de evento único: precisa de título/assunto
genérico (não é sobre 1 evento), de um bloco novo de grid, de selecionar múltiplos eventos na
aba Envio Manual, e de uma forma de registrar no histórico que a campanha foi enviada — sem
quebrar a regra de banco de que toda campanha aponta pra exatamente 1 evento.

## Decisões já validadas com o usuário

1. **Grid de 2 colunas, fixo** — não configurável. Ímpar sobra 1 sozinho na última fileira
   (comportamento normal, sem placeholder vazio ao lado).
2. **Seleção manual** — checklist de eventos na aba Envio Manual, sem campo novo de "data de
   virada" no evento. O admin decide exatamente quais eventos entram naquele disparo.
3. **Assunto sugerido, editável** — gerado a partir da contagem de eventos (ex.: "3 eventos com
   novo lote hoje"), usando o **mesmo mecanismo de placeholder** (`buildEmailMeta`) que o
   template de 1 evento já usa — sem código de assunto novo.
4. **Histórico: todos os eventos aparecem como enviados** — resolvido criando **N linhas em
   `event_email_campaigns` (uma por evento selecionado), todas com o mesmo `egoi_campaign_id`**
   (é literalmente a mesma campanha/e-mail na E-goi). Sem tabela nova, sem migration de
   relacionamento — só um insert em loop em vez de um insert único.

## Achado importante da investigação: reaproveitar, não recriar

Já existe um bloco `weekend_grid` (usado hoje só na "Agenda do FDS") que lista múltiplos
eventos com foto/título/local/CTA por item (`WeekendEventItem`), e a lógica que transforma um
evento do banco nesse formato já existe (`weekend-agenda-draft/index.ts`, sem a parte de
agrupamento por venue do D-Edge, que é específica daquele fluxo). **Porém**, apesar do nome,
`weekend_grid` renderiza os eventos **empilhados, um por linha** nos dois layouts existentes
("cartaz" e "timeline") — não lado a lado. Por isso é necessário um bloco novo (`event_grid`)
que renderiza 2 cards por linha de verdade, usando o mesmo formato de dado (`WeekendEventItem`)
— reaproveitando o "dado", não o "render".

## Arquitetura

### 1. Bloco novo `event_grid`

- **Tipo:** `{ id: string; kind: "event_grid"; title?: string; eyebrow?: string; align?: Align }`
  (sem campo de nº de colunas — YAGNI, decisão já fechada em 2 fixo).
- **Dado:** novo campo `gridEvents?: WeekendEventItem[]` em `EventAnnouncementData` (nome
  separado de `weekendEvents` para não acoplar as duas features).
- **Render:** `supabase/functions/_shared/emailBlocks.ts` (fonte) + porte manual em
  `src/lib/emailTemplates/blocks.ts` (mesma convenção já usada pro resto dos blocos — ver
  comentário no topo de `emailBlocks.ts` sobre a duplicação proposital). Tabela HTML com pares
  de `<td width="50%">` lado a lado por fileira — mesma técnica de 2 colunas já comprovada no
  bloco `event_meta` (`layout: "columns"`), não uma técnica nova. Última fileira ímpar: só 1
  `<td>` preenchido, sem célula vazia ao lado. Cada card reaproveita a MESMA estrutura visual de
  card do `weekend_grid` (foto, `dayLabel`/`timeLabel`, título, venue, botão de ingresso),
  só emparelhados 2 a 2 em vez de empilhados.
- **Hidden:** respeita o mecanismo genérico de `hidden` que já existe pra todos os blocos, de
  graça.

### 2. Template novo `ticket_batch_multi`

- Novo valor no `type`/`template_type` (`src/lib/emailTemplates/blocks.ts`) e no preset
  (`buildPresetBlocks`): header, eyebrow ("ÚLTIMAS HORAS · VIRADA DE LOTE"), bloco `title`
  (usa `event.eventTitle`, que pra esse template vem preenchido com o resumo automático, não o
  nome de 1 evento), `event_grid`, footer.
- **Migration necessária:** `email_templates` tem um `CHECK` (`email_templates_type_check`)
  restringindo `type` a uma lista fixa — `ticket_batch_multi` precisa ser adicionado a essa
  lista (`ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ...` com o novo valor incluído).
  Único ponto do design que exige migration de banco.

### 3. Composição — `buildMultiEventAnnouncementData(events)`

Nova função em `emailComposer.ts` (Deno) — paralela a `buildEventAnnouncementData`, mas recebe
um array de eventos em vez de 1:
- `eventTitle` = resumo automático, ex.: `"3 eventos com novo lote hoje"` (singular quando só 1:
  `"1 evento com novo lote hoje"`) — alimenta tanto o bloco `title` quanto (via
  `buildEmailMeta`) a sugestão de assunto, reaproveitando o placeholder que já existe.
- `gridEvents` = `events.map(...)` no mesmo shape de `WeekendEventItem` (id, title, dayLabel,
  timeLabel, venue, cityState, imageUrl, eventUrl, ticketUrl, ctaLabel) — mapeamento simples,
  sem a lógica de agrupamento por venue do D-Edge (não se aplica aqui: é seleção manual, o
  admin já escolhe exatamente o que quer).
- Demais campos de evento único (flyerUrl, ticketUrl "raiz", lineup, etc.) ficam vazios/não
  usados — o preset deste template nunca inclui blocos de evento único (`hero_image`,
  `cta_button` sozinho), então `validateEmailBlocks` não vai reclamar de campo ausente.

### 4. Edge Function nova `create-multi-event-email-campaign`

Paralela a `create-event-email-campaign`, mas recebe `event_ids: string[]` em vez de
`event_id`:
1. Guards de master switch + `egoi_config` (idênticos ao fluxo de 1 evento).
2. **Claim atômico de todos os eventos**: `UPDATE events SET email_campaign_dispatched_at = now()
   WHERE id = ANY(event_ids) AND email_campaign_dispatched_at IS NULL AND status = 'active'
   RETURNING id`. Se o número de linhas retornadas for menor que `event_ids.length` (algum já
   despachado ou inativo), reverte o claim dos que conseguiu (`SET ... = NULL WHERE id = ANY(...)`)
   e retorna erro listando quais eventos bloquearam — tudo ou nada, para não mandar um grid
   "pela metade" sem querer.
3. Cria **1 campanha** na E-goi (`POST /campaigns/email`) com o HTML já composto — é um único
   e-mail, uma única campanha, igual ao fluxo de 1 evento.
4. Ao confirmar sucesso (rascunho, agendado, ou enviado — mesma lógica de `mode` do fluxo
   atual), insere **N linhas em `event_email_campaigns`** (`campaign_type: 'multi_event'`), uma
   por `event_id`, todas com o mesmo `egoi_campaign_id` retornado pela E-goi. Isso é o que faz
   cada evento aparecer individualmente como "enviado" no histórico (`EmailEventsTab.tsx`), sem
   precisar de tabela de relacionamento nova.
5. Reaproveita `sendEgoiCampaign()` pro caso `sendNow` — chamado **1 vez** (não 1 vez por
   evento, já que é a mesma campanha).

### 5. Aba Envio Manual (`EmailConfig.tsx`)

- Novo estado `batchEventIds: string[]`, ao lado do `batchEventId` (singular) já existente —
  o singular continua servindo os templates de evento único, sem mudança de comportamento.
- Quando o template selecionado tem `type === 'ticket_batch_multi'`, a UI troca o `<Select>` de
  evento único por um checklist multi-seleção (reaproveitando a lista `realEvents` já buscada
  hoje pra popular o dropdown).
- `manualComposition` ganha um branch: se o template é multi-evento, chama
  `buildMultiEventAnnouncementData(eventosSelecionados)` em vez de `buildEventAnnouncementData`.
- Envio (teste/rascunho/agora/agendar) passa a chamar `create-multi-event-email-campaign` com
  `event_ids: batchEventIds` quando em modo multi, em vez de `create-event-email-campaign`.

## Testes planejados

- `emailBlocks_test.ts` (Deno): bloco `event_grid` — 2 colunas por fileira, última fileira ímpar
  com 1 card só, estado vazio, respeita `hidden`.
- Testes de `buildMultiEventAnnouncementData` (pluralização do resumo automático: 1 vs N
  eventos, mapeamento correto pra `gridEvents`).
- Contract test da Edge Function nova (`create-multi-event-email-campaign`) — mesma convenção
  dos outros (só checa fronteira de auth, sem credenciais reais).
- Teste de regressão dedicado confirmando que N linhas são criadas em `event_email_campaigns`
  (uma por evento, mesmo `egoi_campaign_id`) — é o comportamento que o usuário pediu
  explicitamente, merece cobertura direta.
- Teste do "tudo ou nada" no claim: se 1 dos N eventos já foi despachado, nenhum é enviado e o
  claim dos outros é revertido.

## Fora de escopo (por decisão já tomada)

- Nº de colunas configurável (fixo em 2).
- Campo de "data de virada de lote" no evento (seleção é sempre manual).
- Tabela de relacionamento campanha↔eventos (resolvido via N linhas na tabela já existente).
