# Mesclagem de eventos não-destrutiva — Design

**Data:** 17/08/2026
**Status:** aprovado pelo usuário, aguardando plano de implementação

## Contexto

O modelo atual de "Mesclar Eventos" (`MergeEventsDialog.tsx`) elege um dos eventos selecionados
como "principal" e **muta** seus campos (`title`, `date`, `end_date`, `schedule`, `views`,
`blog_post_id`, `tickets_per_day`, `image_url`) pra virar o festival guarda-chuva; os demais
viram `status='merged_inactive'`. Pra "desfazer" funcionar, o merge precisa gravar um snapshot
completo do estado anterior em `application_logs` — e mesclagens feitas antes dessa proteção
existir não têm snapshot nenhum, deixando o botão "Desfazer" inutilizável.

Foi exatamente isso que aconteceu com o merge real "Parador Reveillon" (22/07/2026): sem
snapshot, precisou ser revertido manualmente via SQL (auditoria de 17/08/2026), e a própria
edição do evento principal depois do merge corrompeu os links de venda por dia dos outros 3 dias
(bug corrigido nessa mesma auditoria, ver `docs/TESTING.md` R-073).

O usuário pediu uma lógica nova que **elimine essa classe de bug pela raiz**: mesclar nunca edita
nenhum evento existente — só cria 1 evento novo (o "card-vitrine") e marca os demais como
escondidos. Desmesclar (total ou parcial) vira uma operação trivial de ligar/desligar visibilidade,
sem nenhum dado pra restaurar e sem depender de nenhum log.

## Decisões já validadas com o usuário

1. **Card-vitrine reaproveita a tabela `events`** (não uma tabela nova) — marcado com uma coluna
   nova `is_merge_shell`. Tudo que já funciona pra evento normal (SEO, sitemap, mapa de e-mail,
   listagem, geração de artigo) funciona de graça pra ele.
2. **Ingresso por dia busca ao vivo nos eventos escondidos** (não copia/sincroniza nada pro
   card-vitrine) — editar o link de venda de um dia depois do merge reflete na hora.
3. **Card-vitrine, ao desmesclar, fica guardado inativo — nunca apagado** (mesmo tratamento que
   já existe hoje pra evento escondido).
4. **Desmesclagem parcial** (tirar 1 evento do grupo sem desfazer os outros) precisa continuar
   funcionando — já existe hoje via "Reativar" por card, sem mudança necessária nesse ponto.
5. **Views do card-vitrine nascem somando** as visualizações que os eventos escondidos já tinham
   acumulado até o momento da mesclagem.
6. **Nome sugerido, editável**: pré-preenchido com o título do primeiro evento marcado (mesmo
   padrão de UX de hoje), sem travar em nenhum "principal".
7. **Imagem**: escolha livre entre a imagem de qualquer um dos eventos marcados, ou upload de uma
   nova — nunca um "herdar do principal" automático (não existe mais principal).
8. **`/links` fica inteiramente fora da mesclagem** — nem os eventos escondidos, nem o
   card-vitrine, têm `custom_links` tocado por essa feature. `/links` continua mostrando cada
   evento (mesclado ou não) exatamente como mostra hoje.
9. **Evento "Nostalgia"** (único merge ativo hoje no modelo antigo) é convertido junto — ganha
   `is_merge_shell=true`, sem precisar recriar nada (mesma URL, mesmo card, pro público não muda
   nada).

## Achados da investigação que simplificam o design

- **`/links` nunca filtrou por `events.status`** (`src/hooks/useLinks.ts`) — só por
  `custom_links.enabled` e visibilidade de data. Ou seja: **não mexer em `custom_links` durante a
  mesclagem já satisfaz sozinho** a decisão #8 acima, sem precisar de nenhum filtro novo.
- **`EventDetail.tsx` já redireciona sozinho um evento `status='merged_inactive'` pro
  `merged_into_id`** (linhas 74-83, existente desde a Fase 6.2) — antes mesmo de consultar
  `event_slug_redirects`. Como esta feature nunca renomeia nem apaga a slug de um evento escondido
  (ela mantém a própria slug dele pra sempre), **`event_slug_redirects` deixa de ser necessário
  na mesclagem** — um visitante que abrir a URL antiga de um dia específico já cai no card-vitrine
  de graça, sem nenhum redirect manual pra criar ou (pior) pra ficar órfão depois de um desmesclar
  (foi um redirect órfão exatamente esse tipo de resíduo que precisou ser limpo manualmente no
  Parador).
- **`TicketDayPickerModal.tsx` já faz uma consulta ao vivo** (não lê de `schedule` estático) — só
  precisa trocar a fonte de `custom_links.event_id = <card>` pra `events.merged_into_id = <card>`,
  lendo `date`/`ticket_link`/`title` direto de cada evento escondido. Mudança pequena e isolada,
  1 componente só.

## Modelo de dados

Migration nova, adicionando:

```sql
ALTER TABLE public.events
  ADD COLUMN is_merge_shell BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_merged_into_id
  ON public.events(merged_into_id) WHERE merged_into_id IS NOT NULL;
```

Reaproveita sem alteração: `merged_into_id`, `merged_at`, `status` (`'active' | 'merged_inactive'`).
Nenhuma coluna nova em `custom_links` — a feature não toca nessa tabela.

`merged_into_id` continua apontando pro `id` de outro evento — só que agora esse "outro evento"
é **sempre** um card recém-criado (`is_merge_shell=true`), nunca um dos eventos originais
mutado.

## Fluxo: mesclar

Ao confirmar a mesclagem de N eventos selecionados (`EventsManager`, modo "Mesclar", já
existente):

1. Calcula, sem gravar nada ainda: intervalo de datas (min/max), `schedule` (1 entrada por dia,
   igual hoje), soma de `views`, e se todos os N eventos têm o **mesmo** `ticket_link` (se sim,
   `tickets_per_day=false` e copia esse link único pro card-vitrine; se não, `tickets_per_day=true`
   e `ticket_link=null`, sempre usando o seletor de dia).
2. `venue`/`address`/`location_city`/`location_state`/`genres`/`cta_type`/`time` do card-vitrine
   partem como cópia do **primeiro evento marcado** (mesmo evento que sugere o nome) — editável
   depois normalmente, igual qualquer campo de evento.
3. `title` = o que o admin digitar (sugerido = título do primeiro evento marcado).
4. `image_url` = a imagem escolhida (de um dos N eventos) ou a nova enviada.
5. `blog_post_id = null` sempre — o card-vitrine nasce sem artigo vinculado (nenhum dos artigos
   dos eventos originais é "sobre" o festival mesclado; se quiser um artigo novo, gera normalmente
   depois, ou usa a feature separada "Artigo Multi-Evento").
6. Insere o card-vitrine (`is_merge_shell=true`, `status='active'`) com slug gerada do jeito que
   já se gera pra evento novo hoje (`baseSlug + timestamp`, `useEventFormSubmit.tsx`).
7. `UPDATE events SET status='merged_inactive', merged_into_id=<id do card>, merged_at=now()
   WHERE id IN (<N ids>)`.

Só esses 2 passos de escrita (insert do card + update dos N originais) — nada em `custom_links`,
nada em `event_slug_redirects`, nada em `application_logs`.

## Fluxo: desmesclar

- **Parcial** (tirar 1 evento do grupo): já existe — `EventCard` → "Reativar" → limpa
  `status`/`merged_into_id`/`merged_at` só daquele evento. Sem mudança de comportamento.
- **Total** (desfazer o grupo inteiro): reativa (mesma operação acima) todos os eventos com
  `merged_into_id = <card>`, e marca o próprio card como `status='merged_inactive'` (sem
  `merged_into_id`, já que ele não é membro de nenhum outro grupo). Como o card nunca teve dados
  de nenhum evento original copiados nele (além do que o admin escolheu deliberadamente: nome,
  imagem, venue de partida), não existe "estado anterior" pra restaurar — a operação é sempre
  segura, em qualquer mesclagem, de qualquer idade.

Isso elimina inteiramente a dependência de `application_logs`/snapshot que existe hoje.

## Telas afetadas

- **`MergeEventsDialog.tsx`** — reescrito: remove o rádio "escolha o principal" (não existe mais);
  adiciona seletor de imagem (entre as N ou upload — já existe um protótipo disso do fix anterior,
  vai virar a base) e o cálculo dos campos do card-vitrine descrito acima.
- **`UndoMergeDialog.tsx`** — simplificado: não lê mais `application_logs`; lista os eventos com
  `merged_into_id = <card>` e reativa todos + o próprio card.
- **`MergedEventsTab.tsx`** — `fetchGroups` passa a consultar `events WHERE is_merge_shell=true`
  (com os membros via `merged_into_id`), não mais uma janela de `application_logs` de 90 dias.
- **`useEventsManager.ts`** — `fetchLastMergeLog` (janela de 7 dias) é removido; o botão
  "Desfazer mesclagem" no topo passa a ficar disponível sempre que existir pelo menos 1 card
  (`is_merge_shell=true`, `status='active'`) — sem limite de tempo.
- **`TicketDayPickerModal.tsx`** — troca a fonte da consulta (`custom_links.event_id` →
  `events.merged_into_id`), como descrito acima.
- **`EventCard.tsx`** — sem mudança (já mostra "Inativo · mesclado em X" + "Reativar" pra qualquer
  evento com `merged_into_id`, independe de quem é o alvo).

## Código que fica obsoleto

- Toda a lógica de snapshot em `application_logs` (`context.action IN ('merge_events',
  'undo_merge')`, `primary_pre_merge`, `links_repointed`, `merged_snapshot`) — removida de
  `MergeEventsDialog.tsx` e `UndoMergeDialog.tsx`.
- A carve-out de retenção de 90 dias pra esses logs em `cleanup_old_logs()` (migration
  `20260811222558`) vira inofensiva mas desnecessária — não precisa reverter agora (baixo risco
  deixar como está), mas pode ser limpa numa faxina futura.
- Testes `merge-log-retention-90-days.test.ts` (R-060) e `merge-events-dialog-title-preserved.test.ts`
  (R-024) precisam ser reescritos ou removidos junto — as entradas em `docs/TESTING.md`
  **permanecem** como registro histórico (nunca se apaga uma regressão documentada), só marcando
  que a proteção original foi superada pelo novo design.
- O guard `isMultiLinkEvent` adicionado em `useEventFormSubmit.tsx` nesta mesma auditoria (R-073)
  fica **inofensivo mas com efeito prático raro** — como a mesclagem nova nunca cria múltiplos
  `custom_links` pro mesmo evento, a situação que ele protege deixa de acontecer por construção.
  Não precisa remover (continua correto pra qualquer caso legado ou futuro que crie isso por outro
  caminho).
- O gatilho de sincronização de imagem (R-074, `sync_custom_links_thumbnail_trigger`) **não muda
  nada** — continua funcionando normalmente pra qualquer evento, mesclado ou não.

## Casos de borda

- **Mesclar um evento que já é membro de outro grupo** (`merged_into_id` já preenchido): bloqueado
  na seleção — a lista de eventos disponíveis pra mesclar (`EventsManager`) já esconde
  `status != 'active'`, então um evento escondido não aparece pra ser selecionado de novo. Um
  card-vitrine (`is_merge_shell=true`) também não pode ser selecionado como membro de outro merge
  (checagem explícita no dialog) — evita encadeamento A→B→C.
- **Mesclar com só 1 evento restante depois de desmesclagens parciais**: sem ação especial — o
  card-vitrine continua existindo normalmente mostrando 1 dia só no seletor; o admin pode desfazer
  o resto quando quiser.
- **Editar o card-vitrine pelo formulário normal de evento**: funciona sem nenhum código especial,
  já que ele é um evento comum — só a `schedule`/`tickets_per_day` calculados na mesclagem inicial
  não são recalculados automaticamente depois (mudanças de line-up/data nos eventos escondidos
  refletem no seletor de dia ao vivo, mas não reescrevem a `schedule` armazenada no card-vitrine,
  usada só como exibição inicial da faixa de datas).

## Plano de testes

- Regressão nova: mesclar 3 eventos não altera nenhum campo dos 3 originais (só `status`/
  `merged_into_id`/`merged_at`).
- Regressão nova: desmesclar total reativa todos os membros e inativa o card, em qualquer
  mesclagem (inclusive uma "antiga", sem precisar de log).
- Regressão nova: `TicketDayPickerModal` busca os dias em `events.merged_into_id`, não mais em
  `custom_links`.
- Regressão nova: `/links` non-affected — teste garantindo que a query de `useLinks` continua sem
  nenhum filtro por `status`/`is_merge_shell`.
- `npx tsc --noEmit`, `npm test`, `npm run test:coverage:ratchet` verdes antes de considerar
  pronto.

## Fora de escopo

- Mudar a feature "Artigo Multi-Evento" (`MultiEventArticleModal.tsx`) — continua exatamente como
  está, sem relação com esta mudança.
- Sincronizar/gerar automaticamente um `custom_link` pro card-vitrine em `/links` — decisão #8
  deixa isso deliberadamente manual, se o admin quiser.
- Reverter a migration de retenção de 90 dias de `application_logs` (R-060) — fica como está,
  inofensiva.
