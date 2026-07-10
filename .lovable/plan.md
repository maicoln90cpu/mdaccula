# Onda B.12 — Segmentação por comportamento (baseada nas métricas B.9)

## Objetivo
Permitir que o admin escolha, no momento do disparo, um **segmento comportamental** em vez de mandar sempre para a lista inteira. Isso reduz descadastros, aumenta taxa de entrega e permite mensagens diferentes para perfis diferentes.

## Como está hoje (antes)
- Todo disparo (Enviar agora, Virada de lote, Digest, A/B) envia para a **lista completa** configurada em `egoi_config.list_id`.
- Não há como filtrar "só quem engaja" ou "reengajar quem sumiu".
- O campo `egoi_config.segment_id` existe mas hoje só é usado para a contagem estimada no banner de alcance — não é aplicado no envio real.

## Como fica (depois)
- Novo dropdown **"Segmento"** aparece nos modais **Enviar agora**, **Virada de lote** e **Teste A/B assunto**, com 4 opções:
  1. **Lista completa** (padrão, comportamento atual)
  2. **Engajados** — abriram ≥ 1 dos últimos 3 e-mails enviados
  3. **Frios** — nunca abriram nenhum e-mail nos últimos 60 dias (mas estão inscritos)
  4. **Cliques em ingresso** — clicaram em qualquer link nos últimos 30 dias (potenciais compradores)
- Ao escolher um segmento diferente de "Lista completa":
  - A edge function chama `POST /lists/{list_id}/contacts/search` na E-goi para pegar os e-mails do segmento (paginado, cache 15min).
  - Cria a campanha na E-goi apontando para uma **segmentação temporária** ou envia a lista de e-mails via `extra_data.emails` (fluxo depende do que a v3 aceita — veremos na etapa 1).
  - **Fallback:** se a E-goi v3 não aceitar segmentação dinâmica via API, criamos **listas espelho** (`MDAccula_Engajados`, `MDAccula_Frios`, `MDAccula_Cliques`) sincronizadas por uma edge function agendada e disparamos para essas listas.
- Banner de alcance estimado atualiza para mostrar o tamanho do segmento escolhido antes do envio.
- Histórico grava o segmento usado (`segment_key` novo campo em `event_email_campaigns`).

## Detalhes técnicos
1. **Migration:**
   - `event_email_campaigns.segment_key text null` (`full_list` | `engaged` | `cold` | `clicked_tickets`).
   - `event_email_campaigns.segment_size integer null` (contagem no momento do disparo, para auditoria).
   - Tabela nova `email_segment_snapshots` (opcional): guarda o resultado do cálculo do segmento com TTL de 15min para evitar recontar a cada envio.
2. **Nova edge function `compute-email-segment`:**
   - Input: `{ segment_key: 'engaged'|'cold'|'clicked_tickets' }`.
   - Consulta a E-goi via `egoi-campaign-stats` já materializadas em `event_email_campaign_stats` (que temos desde B.9-extra) para saber quem abriu/clicou o quê.
   - Cruza com a lista da E-goi (`egoi_resources_cache` + fetch fresco quando necessário) para retornar `{ emails: string[], count: number, cached_at: ISO }`.
   - Guarda em `email_segment_snapshots` para reaproveitar por 15min.
   - Auth admin-only.
3. **`create-event-email-campaign` (edge):**
   - Aceita `segment_key` opcional. Se ≠ `full_list`:
     - Chama `compute-email-segment` internamente.
     - Ajusta o payload da E-goi para atingir apenas esses contatos (ver etapa 1 de investigação).
     - Persiste `segment_key` + `segment_size` no histórico.
4. **UI (`EmailConfig.tsx`):**
   - Dropdown "Segmento" nos 3 modais (Enviar agora, Virada de lote, A/B). Reutiliza componente `SegmentSelect`.
   - Banner mostra "Alcance estimado: X contatos (segmento: Engajados)".
   - Histórico exibe badge "Segmento: Engajados" quando `segment_key ≠ full_list`.

## Riscos
- **API da E-goi:** precisamos confirmar se v3 aceita segmentação dinâmica (`extra_data.filter`) ou se dependemos de listas espelho. Vou verificar na etapa 1 antes de qualquer implementação irreversível — se cair no fallback, o custo é maior (cron sincronizando listas espelho) e a implementação é mais complexa; nesse caso pauso e alinho contigo.
- **Volume de dados:** cálculo do segmento "Frios" pode varrer 60 dias de métricas. Cache de 15min mitiga.
- **Métricas B.9 imaturas:** com pouco histórico acumulado, o segmento "Engajados" pode ficar pequeno. Vou mostrar aviso na UI quando o segmento tiver < 100 contatos.
- **Regressão:** todos os fluxos existentes continuam padrão em "Lista completa" — segmentação é opt-in.

## Checklist manual (após implementar)
1. Master switch ON; abrir Histórico de um evento e clicar "Criar rascunho agora".
2. Verificar novo dropdown "Segmento" com 4 opções e alcance estimado atualizando.
3. Escolher "Engajados", confirmar, ver rascunho na E-goi apontando apenas para esse subgrupo.
4. Repetir para "Frios" e "Cliques em ingresso".
5. Verificar badge "Segmento: X" no histórico.
6. Confirmar que escolher "Lista completa" mantém o fluxo idêntico ao atual (regressão).
7. Repetir os 3 testes na aba **Virada de lote** e no modal **Teste A/B assunto**.

## Vantagens x desvantagens
- **+** Mensagens certas para o público certo — menos descadastros, mais engajamento.
- **+** Todos os fluxos existentes se beneficiam sem mudar de tela.
- **+** Segmentação calculada a partir das métricas B.9 que já coletamos.
- **−** Depende de ~30 dias de histórico B.9 para segmentos terem tamanho útil (aviso na UI).
- **−** Se cair no fallback de listas espelho, adiciona uma cron a mais e requer mais permissões na E-goi.

## Prevenção de regressão
- Escolher "Lista completa" deve gerar payload da E-goi bit-idêntico ao fluxo atual (teste unitário do `create-event-email-campaign`).
- Guard: se `segment_key` chegar mas o cálculo retornar 0 contatos, aborta com `skipped: 'empty_segment'` em vez de mandar para lista inteira por engano.

## Pendências (ficam pra depois)
- Segmentos customizados salvos pelo admin (hoje são 4 fixos).
- Segmento "Interessados neste evento" — quem clicou em qualquer link deste evento específico.
- Dashboard comparando performance por segmento.

## Ordem de execução
1. **Investigar** endpoints da E-goi v3 para segmentação dinâmica no envio (via `egoi-curl-probe` na doc). **Se não houver suporte, pauso e alinho o fallback de listas espelho contigo antes de continuar.**
2. Migration (`segment_key`, `segment_size`, tabela `email_segment_snapshots`).
3. Edge function `compute-email-segment`.
4. Ajuste em `create-event-email-campaign` (aceitar `segment_key`).
5. Ajuste em `dispatchEventDraftEmail` + `dispatchAbSubjectTest` para propagar `segment_key`.
6. Componente `SegmentSelect` + integração nos 3 modais.
7. Banner de alcance estimado + badge no histórico.
