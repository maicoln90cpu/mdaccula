# Changelog - MDAccula

> Histórico cronológico do que já foi entregue no projeto. Só registro — nenhum item aqui precisa de ação.
> Itens em aberto (decisões pendentes, bugs conhecidos, checkpoints de monitoramento) ficam em [`PENDENCIAS.md`](PENDENCIAS.md).
> Features novas planejadas (ainda não construídas) ficam em [`ROADMAP.md`](ROADMAP.md).

**Última atualização:** 15/08/2026

---

## Índice

1. [Entradas Detalhadas](#entradas-detalhadas) — ordem cronológica reversa, com descrição e arquivos alterados
2. [Índice Rápido por Mês](#índice-rápido-por-mês) — tabela compacta pra busca rápida
3. [Documentos Relacionados](#documentos-relacionados)

---

## Entradas Detalhadas

### Correção: causa raiz definitiva do "Um ou mais eventos já têm campanha disparada" no disparo de múltiplos eventos — nunca tinha funcionado (R-065)
**Descrição:** mesmo com R-062/R-063/R-064 já no ar, o usuário repetiu o teste ponta a ponta real (template "FDS sem taxa — múltiplos eventos", Music ON + One Life) no próprio navegador e recebeu o mesmo erro de sempre, com os dois eventos travados de novo — hipótese do próprio usuário: "isso parece acontecer com os eventos de grid". Investigação achou uma causa raiz nova e isolada: `create-multi-event-email-campaign` descobria quais eventos tinha reivindicado comparando, por igualdade estrita de string, o timestamp devolvido pelo PostgREST (formato `"...83+00:00"`) contra o `now` gerado em JS via `toISOString()` (formato `"...830Z"`) — dois formatos que NUNCA são iguais pro mesmo instante. Essa comparação nunca era verdadeira, em nenhuma chamada, desde que o recurso existe: confirmado via banco que `event_email_campaigns` nunca teve uma única linha com `campaign_type = 'multi_event'`. O claim de verdade sempre funcionava, mas o código sempre concluía "reivindiquei zero", devolvia 409, e como a liberação de claim parcial só roda quando há IDs reivindicados, a reserva ficava presa pra sempre. Corrigido comparando o valor numérico do instante (`new Date(...).getTime()`) em vez da string.
**Data:** 15/08/2026
**Responsável:** IA, a pedido do usuário — reproduzido pelo usuário no próprio navegador (fora de qualquer automação), pista "eventos de grid" confirmada com evidência concreta (curl direto na REST API, contagem zero de campanhas multi-evento na história do projeto)
**Impacto:** o recurso "Virada de lote" (disparo de e-mail pra múltiplos eventos ao mesmo tempo) passa a funcionar pela primeira vez desde que foi criado. Não é uma reincidência do R-062/R-064 — é uma causa raiz diferente, determinística, isolada nesse único arquivo.

**Arquivos alterados:** `supabase/functions/create-multi-event-email-campaign/index.ts`, `src/__tests__/regression/email-dispatch-multi-event-claim-timestamp-comparison.test.ts` (novo), `email-dispatch-claim-count-not-returning-filter.test.ts` (assertion do R-059 atualizada), `docs/TESTING.md`.

---

### Correção: mesmo sintoma do R-062 reapareceu por uma causa raiz diferente — escrita da Fase 1 sem timeout (R-064)
**Descrição:** testando um disparo real depois do R-062/R-063 já no ar, o mesmo sintoma original voltou (claim setado, zero linha de histórico) — mas por um motivo novo: a própria escrita da linha `in_progress` da Fase 1 em `event_email_campaigns` nunca tinha timeout (só as chamadas de rede pra fora, tipo E-goi e Google Maps, tinham desde R-057). Corrigido envolvendo as 4 funções de `_shared/emailDispatchHistory.ts` em `withTimeout(10s)`, convertendo uma trava na escrita em um erro tratado normalmente, em vez de deixar a promise pendurada pra sempre.
**Data:** 15/08/2026
**Responsável:** IA, a pedido do usuário — investigação via SQL direto no banco (logs da Analytics API do Supabase indisponíveis no momento, mesmo problema já documentado em `docs/PENDENCIAS.md`)
**Impacto:** fecha a última lacuna conhecida da família de bugs "evento trava reservado sem rastro" (R-055/057/058/059/062/064) — agora TODA etapa entre o claim e a confirmação final (rede E rede+banco) tem timeout.

**Arquivos alterados:** `supabase/functions/_shared/emailDispatchHistory.ts`, `src/__tests__/regression/email-dispatch-history-db-write-has-timeout.test.ts` (novo), `docs/TESTING.md`.

---

### Correção: mapa de e-mail e geocodificação de eventos pararam de funcionar após rotação da chave do Google Maps (R-063)
**Descrição:** dentro da mesma auditoria de segurança do R-062, a chave do Google Maps também foi rotacionada — dividida em duas chaves separadas: uma pública (só Maps Embed API, restrita a `mdaccula.com`/`www`/`mdaccula.lovable.app`) e uma nova de servidor (só Static Maps + Geocoding, restrição "Nenhuma"). A troca do valor de servidor quebrou `render-static-map` e `geocode-event` em produção (`500`, "Credential not found") porque as duas functions não chamavam a API do Google diretamente — passavam por um gateway do Lovable (`connector-gateway.lovable.dev`) que esperava reconhecer o valor como uma credencial própria dele, não uma chave crua do Google. Corrigido chamando o Google diretamente (`maps.googleapis.com`) com a chave nova, sem depender do gateway nem do `LOVABLE_API_KEY`. As duas chaves foram testadas manualmente contra o Google (Static Maps, Geocoding e Embed, com e sem referrer autorizado) antes do deploy, todas confirmadas funcionando.
**Achado adicional:** a Geocoding API rejeita qualquer chave com restrição de app "HTTP referrers" — a chave de servidor precisou ficar com restrição "Nenhuma" (compensada por escopo mínimo de API, ver pendência de cota/orçamento em `docs/PENDENCIAS.md`).
**Data:** 15/08/2026
**Responsável:** IA, a pedido do usuário — testes diretos via `curl` contra a API do Google antes do deploy, a pedido explícito do usuário
**Impacto:** mapas de eventos novos em e-mails e geocodificação automática voltam a funcionar; a chave que gera custo real (Static Maps/Geocoding) nunca mais fica exposta a nenhum navegador nem ao Git.

**Arquivos alterados:** `supabase/functions/render-static-map/index.ts`, `supabase/functions/geocode-event/index.ts`, `src/__tests__/regression/google-maps-direct-call-no-gateway.test.ts` (novo), `docs/TESTING.md`, `docs/PENDENCIAS.md`.

---

### Segurança: repositório ficou público — rotacionados 8 segredos de cron expostos
**Descrição:** o repositório do GitHub foi tornado público (pra usar o plano gratuito do GitHub Actions, depois de um bloqueio de cobrança na conta). Isso tornou visível todo o histórico do Git, incluindo migrations antigas que gravam segredos de autenticação de cron em texto puro (padrão usado desde o início do projeto: `INSERT INTO internal_cron_secrets (name, secret) VALUES (...)`). Auditoria feita na sequência: 8 dos 9 segredos hardcoded em migrations foram rotacionados (novo valor gravado direto no banco — `internal_cron_secrets` + o `command` do `cron.job` correspondente — sem precisar de nova migration, então o valor novo nunca entra no Git). Confirmado depois via `net._http_response` que os crons já disparados (`heal-stuck-email-dispatches`, `scheduled-email-send`, `event-reminder`) autenticaram normalmente (HTTP 200) com os valores novos. O nono (`apify_instagram_webhook`) e o segredo compartilhado `CRON_SHARED_SECRET` (achado numa migration mais antiga, usado como autenticação primária por 9 das 10 functions de cron — só `metrics-snapshot` depende exclusivamente dele, as outras 9 usam seu próprio segredo em `internal_cron_secrets` como caminho real) ficaram como decisão pendente do usuário — o primeiro porque rotacionar sozinho quebraria a integração real com a Apify (precisa atualizar dos dois lados ao mesmo tempo); o segundo porque é um secret de ambiente da Edge Function (não uma linha de banco), e só o usuário tem acesso ao painel do Supabase pra defini-lo.
**Correção de rota (mesmo dia):** a primeira versão desta entrada também tirava o `.env` do controle de versão (`git rm --cached` + `.gitignore`). O usuário pediu pra reverter — o Lovable lê esse arquivo diretamente do repositório pra montar build/preview, e tirar do Git quebraria esse fluxo. `.env` voltou a ser versionado. Como o conteúdo dele (chave de navegador do Google Maps) segue público de qualquer forma enquanto isso for necessário, a proteção real passou a ser outra: restrição de referrer **sem** `localhost` na lista (referrer de localhost é fácil de forjar por qualquer pessoa que copie a chave) + limite de cota diária + alerta de orçamento no Google Cloud — registrado como decisão pendente do usuário em `docs/PENDENCIAS.md` (só ele tem acesso ao Google Cloud Console).
**Data:** 15/08/2026
**Responsável:** IA, a pedido do usuário — sweep completo do repositório + rotação direto no banco (sem passar por migration, pra não repetir a exposição)
**Impacto:** os 8 segredos antigos (visíveis pra qualquer pessoa no histórico público do Git) deixam de autenticar qualquer coisa. Nenhum cron parou de funcionar — cada rotação atualizou o banco e o agendamento juntos, na mesma operação, e os que já dispararam desde então confirmaram sucesso real (não só o `net.http_post` ter sido enviado — o corpo da resposta).

**Arquivos alterados:** `docs/PENDENCIAS.md` (3 decisões pendentes registradas), `docs/CHANGELOG.md`. Nenhuma migration nova, nenhuma mudança em `.gitignore`/`.env` no estado final (rotação feita direto em produção via SQL, deliberadamente fora do controle de versão).

---

### Correção: causa raiz definitiva de eventos "presos" sem campanha e sem erro nenhum registrado, e limpeza de 7 eventos afetados (R-062)
**Descrição:** disparo de uma campanha "Virada de lote" (FDS sem taxa) para 2 eventos (Music ON, One Life) mostrou o toast "Um ou mais eventos já têm campanha disparada... Nenhum e-mail foi enviado". Investigação (banco + confirmação manual do usuário no painel da E-goi) mostrou que os 2 eventos estavam com a reserva de disparo travada sem NENHUMA campanha ter sido criada na E-goi — nem como rascunho. O mesmo padrão apareceu em mais 6 eventos recentes (Industria, Hey Hoy, RoofTech, Helvétia, Krush, Solomun); em 4 deles (Industria/RoofTech/Krush/Solomun) o envio original tinha funcionado, mas uma tentativa posterior ficou presa do mesmo jeito, sem afetar o envio antigo. Causa raiz: os 4 patches anteriores desse mesmo sintoma (R-055, R-057, R-058, R-059) só cobrem falhas que lançam uma exceção JavaScript capturável — mas se a Edge Function é interrompida de fora do processo (timeout de plataforma, aba fechada) sem lançar exceção nenhuma, nenhum desses patches é alcançado. Corrigido de forma estrutural: as duas functions de disparo agora gravam a INTENÇÃO do disparo em `event_email_campaigns` (novo status `in_progress`) ANTES de qualquer chamada à E-goi — assim "claim travado sem nenhuma linha de histórico" deixa de ser um estado possível. Um novo cron (`heal-stuck-email-dispatches`, a cada 5 min) destrava automaticamente qualquer linha presa há mais de 5 minutos, com lock otimista pra nunca atropelar um reenvio manual concorrente.
**Achado adicional:** as 4 automações de e-mail recorrentes (lembrete de evento, digest semanal, digest do blog, agenda do fim de semana) tinham cada uma sua própria cópia da chamada à E-goi sem timeout — um bug já identificado e registrado em `docs/PENDENCIAS.md` como pendente, agora corrigido junto (elimina a duplicação e usa a versão compartilhada, protegida com timeout).
**Data:** 15/08/2026
**Responsável:** IA, a pedido do usuário — investigação via Supabase MCP (`execute_sql`) e confirmação manual do usuário no painel da E-goi, evento por evento
**Impacto:** os 7 eventos afetados (Music ON, One Life, Helvétia, RoofTech, Krush, Solomun, Industria) voltaram a ficar disponíveis para disparo/reenvio normal, sem nenhum impacto no histórico de campanhas reais já enviadas. Futuras interrupções de plataforma no meio de um disparo se auto-resolvem em até 5 minutos, em vez de deixar o evento travado indefinidamente e sem explicação visível.

**Arquivos alterados:** `supabase/functions/create-event-email-campaign/index.ts`, `supabase/functions/create-multi-event-email-campaign/index.ts`, `supabase/functions/_shared/emailDispatchHistory.ts` (novo), `supabase/functions/heal-stuck-email-dispatches/index.ts` (novo), `supabase/functions/send-event-reminder-campaigns/index.ts`, `supabase/functions/weekly-digest-draft/index.ts`, `supabase/functions/blog-digest-draft/index.ts`, `supabase/functions/weekend-agenda-draft/index.ts`, `supabase/migrations/20260815160000_event_email_campaigns_in_progress_status.sql` (nova), `supabase/migrations/20260815160500_heal_stuck_email_dispatches_cron.sql` (nova), `supabase/migrations/20260815161000_cleanup_phantom_email_dispatch_claims.sql` (nova), `supabase/config.toml`, `docs/tabelas.md`, `docs/EDGE_FUNCTIONS.md`, `docs/TESTING.md`, `docs/PENDENCIAS.md`, testes novos em `src/__tests__/regression/` (`email-dispatch-in-progress-status-allowed`, `email-dispatch-in-progress-row-before-egoi-call`, `email-dispatch-catch-respects-confirmed-creation`, `email-dispatch-heal-stuck-optimistic-lock`, `email-automations-egoi-request-uses-shared-timeout`) e atualização de `email-dispatch-history-write-error-swallowed.test.ts` (R-058).

---

### Correção: logo do e-mail e arte de "virada de lote" pararam de bypassar o Bunny CDN (R-061)
**Descrição:** investigação do pico de ~1,12 GB de "Cached Egress" do Supabase em 11/08/2026 (estourou o limite do plano gratuito e derrubou o site, forçando upgrade de emergência). O monitor interno de egress não alertou nesse dia — confirmado que `egress-alert-cron` rodou normalmente, mas só enxerga tráfego REST/Functions (via Service Worker + 4 Edge Functions instrumentadas manualmente), nunca leituras do Supabase Storage; o total registrado internamente pro dia todo foi de ~880 KB, uma fração do 1,12 GB oficial. Causa confirmada de parte do pico: `uploadLogo` (`useEmailConfigState.ts`) e `uploadBatchArtwork` (`useManualBatch.ts`) subiam a imagem direto pro bucket `link-thumbnails` do Supabase Storage com `getPublicUrl()` cru, nunca pelo Bunny CDN — diferente de toda imagem de evento/blog/team do resto do app. `logo_url` vai no header de todo e-mail disparado pelo sistema; `batchArtworkUrl` vira o flyer de disparos manuais de "virada de lote", que podem ir pra segmentos de +13 mil contatos. `storage_logs` do dia 11/08 mostra múltiplos bots de e-mail distintos (Gmail, scanner estilo Outlook, relay de e-mail) baixando o mesmo objeto no mesmo dia em que saiu uma campanha `weekly_digest` (lista completa) + 2 campanhas `standard` — cada abertura/scan por destinatário/provedor puxava egress real da origem do Supabase.
**Data:** 12/08/2026
**Responsável:** IA, a pedido do usuário — investigação via Supabase MCP (`execute_sql`, `query_logs`, cron), CodeGraph e `git log`
**Impacto:** logo e arte de disparo manual agora servidos pelo Bunny CDN (mesmo padrão do resto do app) — remove a fonte de egress multiplicada por destinatário/provedor de e-mail identificada nos logs do incidente.

**Achados/correções adicionais na mesma investigação (a pedido do usuário):**
- `email_template_settings.logo_url` (o logo em produção agora mesmo) estava vazando desde 09/07/2026 — `migrate-to-bunny` ganhou a ação `migrate_single_file` (cobre arquivos em subpasta, que a listagem plana de `migrate_files` nunca alcançava) e a coluna entrou em `URL_COLUMNS` pra detecção/correção pela mesma ferramenta já existente em `/admin/settings` → Mídia. **Executado em produção em 13/08/2026** (autenticado com a credencial de admin de `.env.local`, usada só localmente pra e2e): `migrate_single_file` copiou o arquivo pro Bunny, `update_urls` reescreveu a coluna — confirmado com SELECT direto (`logo_url` agora é `https://mdaccula.b-cdn.net/link-thumbnails/email-template/logo-1783617807134.jpg`) e HTTP 200 direto na URL nova.
- `egress-alert-cron` ganhou um segundo sinal, independente de `egress_metrics`: contagem real de requisições de `storage_logs` (via Logs/Analytics API do Supabase) nas últimas 24h vs. média dos 7 dias anteriores. Fecha o ponto cego que deixou o pico de 11/08 passar sem alerta. Requer o secret `MANAGEMENT_API_TOKEN` (nome ajustado depois de descobrir na prática que o Supabase bloqueia qualquer secret de Edge Function com "SUPABASE" no nome); `METRICS_API_KEY` (secret antigo do projeto) foi testado primeiro e confirmado que não é um PAT válido. Com `MANAGEMENT_API_TOKEN` a autenticação passou a funcionar, mas o endpoint público de Analytics do Supabase está devolvendo erro transiente consistentemente nos testes (mesma SQL funciona via MCP) — **acompanhamento em `docs/PENDENCIAS.md`, não bloqueia o resto da correção**.

**Arquivos alterados:** `src/components/admin/emailConfig/useEmailConfigState.ts`, `src/components/admin/emailConfig/useManualBatch.ts`, `supabase/functions/migrate-to-bunny/index.ts`, `supabase/functions/egress-alert-cron/index.ts`, `supabase/functions/_shared/managementLogsApi.ts` (novo), `supabase/functions/_shared/managementLogsApi_test.ts` (novo), `src/__tests__/regression/email-logo-and-batch-artwork-bypass-cdn.test.ts` (novo), `docs/TESTING.md`.

---

### Correção: retenção de log de mesclagem de eventos alinhada à janela do "Desfazer" (R-060)
**Descrição:** o botão "Desfazer" da aba "Eventos Mesclados" ficava bloqueado antes do previsto porque `cleanup_old_logs()` (cron diário, 3h) apagava TODO `application_logs` com mais de 7 dias, incluindo os logs `action: 'merge_events'` que guardam o snapshot pré-merge — enquanto `MergedEventsTab.tsx` consulta esses mesmos logs numa janela de 90 dias. Descoberto ao tentar desfazer pela UI a mesclagem do evento "Parador apres. Cat Dealers e+++" (absorveu "Parador apres. Chemical Surf e+++" em 19/07/2026): com só 23 dias de mesclagem, o log já tinha sido limpo. Migration `20260811222558_extend_merge_log_retention_for_undo.sql` recria `cleanup_old_logs()` isentando `merge_events`/`undo_merge` da limpeza de 7 dias, retendo-os por 90 dias (igual à janela consultada pela UI); os demais logs continuam com 7 dias. Como o log dessa mesclagem específica já tinha sumido antes da correção acima, o desfazer do caso concreto (Cat Dealers/Chemical Surf) foi feito via SQL direto em produção, reconstruindo o estado pré-merge a partir do próprio evento absorvido (que preserva date/schedule/lineup/views intactos, por ser soft-delete) — sem gerar snapshot em log, então esse caso específico não pode ser refeito pela UI se for preciso reverter de novo.
**Data:** 11/08/2026
**Responsável:** IA, a pedido do usuário
**Impacto:** próximas mesclagens de eventos poderão ser desfeitas pela UI por até 90 dias em vez de 7; evita repetir a correção manual via SQL. Evento "Parador apres. Cat Dealers e+++" e "Parador apres. Chemical Surf e+++" voltaram a ser 2 eventos independentes e ativos.

**Arquivos alterados:** `supabase/migrations/20260811222558_extend_merge_log_retention_for_undo.sql` (nova), `src/__tests__/regression/merge-log-retention-90-days.test.ts` (novo), `docs/TESTING.md`.

---

### Verificação: envio segmentado confirmado funcionando com a correção do R-059
**Descrição:** fechamento do checkpoint deixado pelo R-059 — o fix daquele dia só tinha sido validado pra "toda a lista" (evento Sirius); o caminho de segmento por disparo (o cenário original que abriu a investigação: lista "abertura maior que 1") ainda não tinha sido testado com a correção. Testado agora com um evento novo (Industria apres. Blazy e Omiki, 16/10/2026), template "Novo evento — padrão", segmento "Abertura Maior 1" (13.068 contatos): "Criar rascunho na E-goi" → sucesso (campanha `#24fbb43d...`, `event_email_campaigns.segment_id = 3`, `error_message: null`); "Enviar agora" (com os 2 diálogos de confirmação da UI) → sucesso (campanha `#a6bb7b5f...`, `status: sent`, mesma linha do histórico reaproveitada), confirmado visualmente na aba Histórico e controle como "Enviado". Nenhum bug novo apareceu — o R-059 corrige o `dispatch_in_progress` pros dois caminhos (lista inteira e segmentada), como já indicava a análise da causa raiz (o bug estava na detecção do claim, uma etapa anterior e comum a ambos os fluxos, não em nada específico de segmento).
**Data:** 10/08/2026
**Responsável:** IA, a pedido do usuário — teste via navegador real (Claude-in-Chrome, mesmo esquema usado pro teste do Sirius)
**Impacto:** fecha de vez a investigação do `dispatch_in_progress` — os dois caminhos de disparo manual (toda a lista e segmentado) estão confirmados funcionando ponta a ponta em produção. Nenhuma mudança de código nesta entrada (só verificação); checkpoint correspondente removido de `docs/PENDENCIAS.md`.

**Arquivos alterados:** nenhum (verificação apenas); `docs/TESTING.md`, `docs/PENDENCIAS.md`.

---

### Fix: causa raiz definitiva de TODOS os `dispatch_in_progress` — PostgREST reaplicava o filtro do claim sobre o valor recém-gravado (R-059)
**Descrição:** mesmo com R-052 a R-058 corrigidos e implantados, o evento Sirius seguia travando com `dispatch_in_progress` em toda combinação, e o `console.error` novo do R-058 nunca disparou em nenhum disparo real — descartando de vez a hipótese de erro de gravação silencioso. Confirmado via SQL direto (`BEGIN; ...; ROLLBACK;`, sem persistir nada): o claim atômico (`.update({email_campaign_dispatched_at: now}).or('col.is.null,col.lt.X').select().maybeSingle()`) sempre travava a linha de verdade no banco, mas o PostgREST reaplica o WHERE do UPDATE sobre o RETURNING antes de devolvê-lo — e como esse WHERE testava a própria coluna que tinha acabado de ser sobrescrita, a condição nunca era verdadeira contra o valor novo. `.select()` sempre devolvia vazio, `.maybeSingle()` sempre devolvia `null`, e o código sempre concluía "perdi a corrida" — pra TODO disparo manual, mesmo sem nenhuma corrida real acontecendo. Isso explica por que nenhuma das 5 causas reais corrigidas em R-052–R-058 resolvia o sintoma: todas eram bugs genuínos, mas nenhuma delas era alcançada de forma diferente — a detecção do claim falhava antes.
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário — mudança de abordagem explícita para testar via navegador real com Claude-in-Chrome contra o localhost, iterando até o envio funcionar de fato)
**Impacto:** o UPDATE do claim troca `.select().maybeSingle()` por `{ count: 'exact' }` — o Postgres calcula esse count a partir das linhas realmente afetadas pelo UPDATE, sem reaplicar o filtro contra os valores novos. Uma leitura separada, logo após vencer o claim, busca os detalhes necessários (title/status no evento único; comparação exata do `now` gravado pra descobrir os IDs claimados no caso multi-evento). R-052 a R-058 permanecem válidos como hardening (mensagem de erro exposta, claim liberado em falha não tratada, timeouts em fetches, erro de histórico não mais engolido) mesmo não sendo a causa raiz deste sintoma específico.
**Verificação real pós-deploy:** teste ponta a ponta pelo navegador (evento Sirius, template "Virada de lote", toda a lista) — "Criar rascunho na E-goi" e "Enviar agora" concluídos com sucesso (campanhas `#6c8457ee...` e `#157dfe55...`), histórico gravado e atualizado corretamente (draft → sent, mesma linha reaproveitada), confirmado visualmente na aba Histórico e controle como "Enviado". Detalhes completos em `docs/TESTING.md` (entrada R-059).

**Arquivos alterados:** `supabase/functions/create-event-email-campaign/index.ts`, `supabase/functions/create-multi-event-email-campaign/index.ts`, `src/__tests__/regression/email-dispatch-claim-count-not-returning-filter.test.ts` (novo), `src/__tests__/regression/email-dispatch-claim-returning-filter-column.test.ts` (reescrito — R-054 passa a confirmar a AUSÊNCIA de `.select()` encadeado, não sua presença), `docs/TESTING.md`.

---

### Fix: causa raiz definitiva do "dispatch_in_progress" — erro real na gravação do histórico era engolido silenciosamente (R-058)
**Descrição:** mesmo após R-052 a R-057, o evento Sirius continuou travando com `dispatch_in_progress` em TODAS as combinações (rascunho/enviar agora × segmento/lista inteira) — respostas 200 rápidas (2-3s), sem erro, sem log. Investigação só-leitura (logs + SQL) mostrou que a function não estava travando nem dando exceção: dos 3 caminhos que mantêm HTTP 200 depois do claim, só `created.ok === true` (E-goi aceitou a criação da campanha) é consistente com o claim ficar preso sem se resetar — e esse caminho termina sempre no mesmo `.update()`/`.insert()` final em `event_email_campaigns`, cujo `{ error }` do Supabase-js nunca era destructurado. Uma falha de banco nesse ponto (RLS/constraint/etc., causa exata ainda não confirmada) ficava 100% silenciosa. O bug não tinha nada a ver com segmento — é o mesmo ponto de código em todo disparo que chega a criar a campanha na E-goi, por isso as 4 combinações falhavam igual.
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário, "ultrathink" — investigação mais profunda pedida após R-052 a R-057 não resolverem o sintoma final)
**Impacto:** o erro real de gravação agora é logado (`console.error`) e devolvido na resposta (`error`) — sem alterar a política de liberação do claim (a campanha real na E-goi já existe nesse ponto, então o claim é mantido de propósito, mesma lógica do ramo `created.ok === false` já existente). A causa raiz Postgres exata ainda depende do próximo disparo real em produção para aparecer nos logs — ver `docs/PENDENCIAS.md`.

**Arquivos alterados:** `supabase/functions/create-event-email-campaign/index.ts`, `src/__tests__/regression/email-dispatch-history-write-error-swallowed.test.ts` (novo), `docs/TESTING.md`, `docs/PENDENCIAS.md`.

---

### Fix: `egoiRequest` sem timeout — hipótese intermediária, insuficiente sozinha (R-057)
**Descrição:** mesmo após R-055 (libera claim + timeout no cache de mapas), o evento Sirius continuou travando com `dispatch_in_progress`, desta vez sem nenhum log de erro sequer — o claim ficava preso por mais de 1 minuto sem a function nunca lançar uma exceção catchável. A pista decisiva veio do usuário: "isso funcionava antes, só a função de enviar por segmento que não havia sido testada ainda" — `egoi_config.segment_id` global está `null`, então todo disparo anterior sempre foi pra "toda a lista"; o Sirius foi o primeiro a usar o override de segmento por disparo (aba Envio manual) contra a API real da E-goi. Hipótese testada: `egoiRequest` (`supabase/functions/_shared/egoiClient.ts`), usado tanto pra criar quanto pra enviar a campanha, fazia `fetch()` sem nenhum timeout. Insuficiente sozinha — o mesmo erro reapareceu depois em TODAS as combinações (não só segmento); a causa real (não relacionada a timeout nem a segmento) foi achada no R-058, acima.
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário, "ultrathink" — investigação mais profunda pedida após 2 tentativas anteriores não resolverem)
**Impacto:** `egoiRequest` ganha `AbortSignal.timeout(25s)` — hardening válido independente da causa raiz (nunca mais deixa a function pendurada esperando a E-goi), mas não era a causa deste bug específico.

**Arquivos alterados:** `supabase/functions/_shared/egoiClient.ts`, `supabase/functions/_shared/egoiClient_test.ts`, `docs/TESTING.md`, `docs/PENDENCIAS.md`.

---

### Fix: badges do line-up coladas sem espaço no Outlook (R-056)
**Descrição:** usuário reportou print real do e-mail do evento Sirius — no Outlook os nomes dos artistas no bloco de line-up (layout "chips") apareciam colados uns nos outros ("D-Nox deKolombo beRiascode..."), enquanto no Gmail o layout de pills renderizava normalmente. Causa: `renderInteractiveBlock` (`supabase/functions/_shared/emailBlocks/renderBlock/interactive.ts`) unia os `<span>` de cada artista com `.join("")` — sem separador real, só contando com `display:inline-block`+`margin` (que o Outlook, engine do Word, ignora em e-mail) pro espaçamento visual. Corrigido trocando pra `.join(" ")`, garantindo um espaço real no HTML independente do cliente respeitar o estilo da pill.
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário, que anexou o print do bug real)
**Impacto:** visual apenas, sem mudança de dados/lógica de envio.

**Arquivos alterados:** `supabase/functions/_shared/emailBlocks/renderBlock/interactive.ts`, `supabase/functions/_shared/emailBlocks/renderBlock/interactive_test.ts` (novo), `docs/TESTING.md`.

---

### Fix: evento ficava travado ("dispatch_in_progress") sem log de erro em falhas não previstas (R-055)
**Descrição:** mesmo após R-052/R-053/R-054, o evento Sirius seguia recusando reenvio minutos depois da última tentativa, sem nenhuma campanha criada e sem rastro de erro nos logs. Causa: o claim atômico anti-envio-duplicado (`events.email_campaign_dispatched_at`) só era liberado nos caminhos de erro já tratados explicitamente — uma falha não prevista (provável `fetch()` sem timeout no cache de imagens de mapa via Bunny CDN, que teve avisos reais de timeout/connection reset nos logs desse período) travava a function inteira sem passar por nenhum `catch`, deixando o claim preso. Corrigido em 2 frentes: os `catch` externos das duas Edge Functions de disparo agora liberam o claim antes de responder 500 (para qualquer falha, não só as tratadas); os `fetch()` do cache de mapas (Bunny CDN + render-static-map) ganharam `AbortSignal.timeout`.
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário, que reportou o novo sintoma `dispatch_in_progress`)
**Impacto:** nenhuma mudança de regra de negócio; evento Sirius destravado manualmente via SQL como mitigação imediata (seguro, não afeta histórico).

**Arquivos alterados:** `supabase/functions/create-event-email-campaign/index.ts`, `supabase/functions/create-multi-event-email-campaign/index.ts`, `supabase/functions/_shared/bunnyUploadBytes.ts`, `supabase/functions/_shared/renderStaticMapCache.ts`, `src/__tests__/regression/email-dispatch-claim-released-on-uncaught-error.test.ts` (novo), `docs/TESTING.md`.

---

### Hotfix: falso erro de coluna ausente no claim do reenvio manual (R-054)
**Descrição:** o erro `column events.email_campaign_dispatched_at does not exist` reapareceu após a recarga do cache. O SQL real capturado nos logs do Postgres revelou a causa definitiva: o PostgREST reaplicava o filtro do `UPDATE` sobre o conjunto retornado, mas esse retorno continha apenas `id`, `status` e `title`. A coluna existia normalmente na tabela; faltava apenas no resultado temporário. O claim agora também retorna `email_campaign_dispatched_at`, sem remover a proteção contra envio duplicado.
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário)
**Impacto:** baixo e localizado no claim anterior ao envio; nenhuma alteração de banco ou de destinatários.

**Arquivos alterados:** `supabase/functions/create-event-email-campaign/index.ts`, `src/__tests__/regression/email-dispatch-claim-returning-filter-column.test.ts`, `docs/TESTING.md`, `docs/CHANGELOG.md`.

---

### Fix: mensagem de erro real do disparo manual de e-mail ("Enviar agora") não chegava ao admin
**Descrição:** usuário reportou erro genérico ("erro de função") ao tentar enviar o template "virada de lote" do evento Sirius para uma lista segmentada pela aba Envio manual. Investigação (log real do Supabase: `POST 500` em `create-event-email-campaign` às 15:23:56) achou 2 bugs compostos: (1) `dispatchEventDraftEmail`/`dispatchMultiEventDraftEmail` (`src/lib/emailTemplates/dispatchEventDraft.ts`) usavam `error.message` direto no retorno de `supabase.functions.invoke()` — só a mensagem genérica do SDK, nunca a mensagem JSON real que a Edge Function monta — em vez do helper `getEdgeFunctionErrorMessage` (já usado em outros pontos do admin pra esse exato problema); (2) os `catch` externos de `create-event-email-campaign` e `create-multi-event-email-campaign` respondiam 500 sem nenhum `console.error`, então nem os logs do Supabase guardavam rastro da exceção real. Ver R-052 em `docs/TESTING.md`.
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário — "retornou com erro de função, investigue a causa")
**Impacto:** nenhuma mudança de comportamento de envio — só diagnóstico. A causa raiz da falha 500 específica do Sirius foi encontrada logo em seguida (ver entrada abaixo).

**Arquivos alterados:** `src/lib/emailTemplates/dispatchEventDraft.ts`, `supabase/functions/create-event-email-campaign/index.ts`, `supabase/functions/create-multi-event-email-campaign/index.ts`, `src/__tests__/regression/dispatch-event-draft-error-message-surfaced.test.ts` (novo), `docs/TESTING.md`, `docs/PENDENCIAS.md`.

---

### Diagnóstico intermediário: recarga do cache do PostgREST (R-053)
**Descrição:** com a mensagem de erro real já visível, o disparo do evento Sirius falhava com `column events.email_campaign_dispatched_at does not exist`, embora a coluna existisse. A recarga do cache foi aplicada como primeira medida segura, mas a recorrência posterior provou que ela não era a solução definitiva. O SQL detalhado revelou depois a causa real no `UPDATE ... RETURNING`, corrigida no R-054 acima. O registro foi preservado e corrigido para não transformar uma hipótese intermediária em causa definitiva.
**Data:** 10/08/2026
**Responsável:** IA + Lovable (em paralelo, mesmo diagnóstico) — a pedido do usuário
**Impacto:** nenhuma migração destrutiva e nenhuma mudança de regra de negócio; diagnóstico intermediário posteriormente substituído pelo R-054.

**Arquivos alterados:** `docs/TESTING.md`, `docs/PENDENCIAS.md`, `src/components/admin/emailConfig/EmailEventsTab.tsx` (fix do Lovable), `supabase/migrations/20260810164322_2c9076db-a2ab-4224-9def-55592e31508b.sql` (novo, do Lovable).

---

### Fix: CI/CD Pipeline (Quality Checks → ESLint) quebrado no `main` desde 09/08/2026
**Descrição:** resolve o item registrado em `docs/PENDENCIAS.md` — 8 erros de ESLint em 3 arquivos não relacionados ao trabalho desta sessão (introduzidos no commit `d31b121`, antes desta sessão começar): `useEmailConfigState.ts` (imports não usados — `MOCK_EVENT_DATA`, `EventAnnouncementData`, `ArticleSummary`, parâmetro `templates` nunca lido dentro do hook, removido também do chamador em `EmailConfig.tsx`; 2 `react-hooks/exhaustive-deps` faltando `setTemplates`/`setActiveTemplateId` — setters de `useState` do pai, identidade sempre estável, adicionar não muda comportamento), `eventForm/constants.ts` (`import()` inline trocado por `import type` no topo) e `list_links.ts` (import não usado de `zod`).
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário)
**Impacto:** nenhum (só limpeza de lint, zero mudança de comportamento). Confirmado no CI real: job "Quality Checks" voltou a passar.

**Arquivos alterados:** `useEmailConfigState.ts`, `EmailConfig.tsx`, `eventForm/constants.ts`, `list_links.ts`.

---

### Feature: reorganização dos controles de geração de conteúdo — Fase C + painel único (10 melhorias)
**Descrição:** fecha a reorganização dos 8 caminhos de geração, isolando os toques no `auto-article-cron` (regra do projeto: nunca agrupar itens de alto risco) e entregando as 10 melhorias que o usuário aprovou incluir todas:
- **C1** — cron passa a ler `auto_publish_auto_cron` (chave própria) em vez de `suggestions_auto_publish` (compartilhada com o caminho manual). Zero toque na lógica de descoberta/seleção de matéria.
- **C2 (item #2)** — `isContentSubstantial` roda de novo bem no fim, em `generate-blog-post-v2` (nunca tinha NENHUMA checagem), `generate-multi-event-article` e `generate-blog-post-from-topic` (2ª camada), antes de decidir `published`. Gap real achado no caminho: o Event Watcher publica via um `UPDATE` separado do insert — bypassava essa checagem inteira; corrigido repetindo-a em `scan-event-sources`/`apify-instagram-webhook`.
- **C3 (itens #4/#5/#6)** — cooldown configurável (`auto_article_source_cooldown_days`) exclui fontes usadas com sucesso recentemente do sorteio, com fallback pra nunca travar a geração; streak seco (`content_dry_streak`) alerta quando uma fonte fica várias execuções sem matéria nova; `content_last_picked_at` só grava na fonte que efetivamente gerou.
- **C4 (item #3)** — `_shared/autoPublishAlert.ts` avisa por e-mail (recipiente em `auto_publish_alert_email`) só quando `auto-article-cron`/Event Watcher publicam de fato sem revisão. `resendEmail.ts` promovido de `egress-alert-cron/` pra `_shared/`.
- **Painel único** — nova seção "Controle de publicação por tipo de geração" na aba Automático: 8 linhas (1 por caminho), selo de "raspagem real" e toggle rascunho/publicado. Substitui o toggle único antigo e o Card duplicado de auto-publish do Event Watcher em `BlogManager.tsx`.
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário — "pode incluir todos os itens")
**Impacto:** médio no `auto-article-cron` (C1/C3, isolados e testados um de cada vez, com force-run real verificado após cada um — confirmado ao vivo: cooldown excluindo fonte recém-usada, streak seco incrementando/zerando, e-mail de aviso disparado com toggle ligado). 308 testes Deno + 576 testes Vitest + typecheck, todos verdes.

**Arquivos alterados:** `auto-article-cron/index.ts`, `_shared/autoPublishAlert.ts` (novo), `_shared/resendEmail.ts` (movido), `scan-event-sources/index.ts`, `apify-instagram-webhook/index.ts`, `_shared/generateBlogPostV2/savePost.ts`, `generate-blog-post-v2/index.ts`, `generate-multi-event-article/index.ts`, `generate-blog-post-from-topic/index.ts`, `AutoGenerationPanel.tsx`, `BlogManager.tsx`.

---

### Feature: reorganização dos controles de geração de conteúdo — Fase B (toggles + origem + imagem real)
**Descrição:** liga o toggle "rascunho vs. publicado" (`useAutoPublishSettings`, Fase A) nos 5 caminhos que hoje publicavam sempre sem controle: aba "Gerar" (`auto_publish_generate_tab`), "Sugestões→template" (`auto_publish_suggestions_template`), "Por Tema" (`auto_publish_topic_search`), "Artigo consolidado"/Multi-Evento (`auto_publish_multi_event`, novo suporte a `publishImmediately` em `generate-multi-event-article`) e "Gerar artigo"/"Por evento" — tanto pelo botão em Eventos quanto pelo checkbox na criação do evento (`auto_publish_single_event`). Toast da aba "Gerar" corrigido (dizia "salvo como rascunho" mesmo quando publicava). Todo insert em `ai_generated_posts` (dos 8 caminhos, incluindo Event Watcher) passa a gravar `generation_source`; `BlogManager`/`PostsHistory` usam essa coluna pra rotular a origem em vez da heurística antiga de `prompt_used` (que não reconhecia o automático). Item #1: "Por Tema"/"Sugestões→tema" passam a tentar imagem real (og:image + busca Firecrawl) sobre a 1ª fonte encontrada antes de cair pra IA — mesma camada já usada pelo automático.
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário)
**Impacto:** médio (muda comportamento de publicação de 5 caminhos manuais — todos defaultam pra rascunho até o admin ligar o toggle correspondente na aba "Automático"). 301 testes Deno + 564 testes Vitest + typecheck, todos verdes.

**Arquivos alterados:** `generate-blog-post-v2/index.ts` + `_shared/generateBlogPostV2/savePost.ts`, `generate-blog-post-from-topic/index.ts`, `generate-multi-event-article/index.ts`, `scan-event-sources/index.ts`, `apify-instagram-webhook/index.ts`, `AIContent2.tsx`, `useSuggestionActions.ts`, `MultiEventArticleModal.tsx`, `useEventsManager.ts`, `useEventFormSubmit.tsx`, `eventArticlePayload.ts`, `BlogManager.tsx`, `PostsHistory.tsx`, `aiContent/types.ts`.

---

### Feature: reorganização dos controles de geração de conteúdo — Fase A (base + Dashboard)
**Descrição:** primeira fase da reorganização completa dos 8 caminhos de geração de artigo (pedido do usuário, mapeados na resposta anterior). Base de dados nova: 8 chaves `site_settings` de publicação por tipo de geração (default rascunho), 4 colunas novas em `event_sources` (cooldown/streak/verificação semanal — itens #4/#5/#6/#10), `ai_generated_posts.generation_source` (identifica qual dos 8 caminhos gerou cada post). Novo hook `useAutoPublishSettings`. Novo componente `ContentDashboard` como 1ª aba de "Conteúdo IA": publicados/rascunhos/views, saúde do automático, publicado vs rascunho e views por período, geração por tipo, top 5 mais lidos. `FontesManager` ganha coluna "Saúde (automático)" com selo de fonte seca e última verificação. Nova edge function `verify-sources-weekly` (item #10) — checagem semanal sem gerar/publicar, cron próprio (segunda 09h BRT), isolada do `auto-article-cron`.
**Data:** 10/08/2026
**Responsável:** IA (a pedido do usuário)
**Impacto:** baixo (tudo aditivo — nenhum caminho de geração existente foi alterado nesta fase). 301 testes Deno + 555 testes Vitest + typecheck, todos verdes. Corrigido de passagem um bug de infra de teste (mock de `ResizeObserver`/`IntersectionObserver` em `setup.ts` não era construível via `new`, quebrava qualquer render de gráfico recharts).

**Arquivos alterados:** migrações `content_generation_publish_settings`, `event_sources_cooldown_and_verify_columns`, `ai_generated_posts_generation_source`, `verify_sources_weekly_cron`; `src/hooks/useAutoPublishSettings.ts` (novo), `src/components/admin/ai-content/ContentDashboard.tsx` (novo), `src/pages/admin/AIContent2.tsx`, `src/pages/admin/FontesManager.tsx`, `src/types/index.ts`, `src/integrations/supabase/types.ts`, `supabase/functions/verify-sources-weekly/` (novo), `supabase/config.toml`, `src/__tests__/setup.ts`, docs (`tabelas.md`, `DATABASE_SCHEMA.md`, `EDGE_FUNCTIONS.md`).

---

### Hotfix: "Sugestões"/"Por Tema" podiam gerar artigo inteiro em outro idioma (R-051)
**Descrição:** validação da Fase 0 do mapeamento completo dos 8 caminhos de geração de conteúdo (a pedido do usuário) — gerado artigo real via "Sugestões" (tema livre) sobre um DJ argentino, cujas 2 fontes reais (djmagla.com, laf5.com) estavam em espanhol. O artigo saiu **inteiro em espanhol** — nenhum dos 2 prompts de `generate-blog-post-from-topic` (automático e manual) tinha qualquer instrução de idioma.
**Correção:** novo bloco `REGRA CRÍTICA — IDIOMA` nos 2 prompts, exigindo português do Brasil sempre, mesmo com fonte em outro idioma (nomes próprios/faixas/citações diretas podem continuar no idioma original).
**Data:** 10/08/2026
**Responsável:** IA (achado durante validação pedida pelo usuário, não reportado por ele)
**Impacto:** baixo (aditivo — 296 testes Deno + suite Vitest, todos verdes). Confirmado corrigido 2x seguidas com geração real (Nacho Bolognani e Camelphat, ambos com fontes em espanhol, ambos saíram em português após o fix).

**Arquivos alterados:** `supabase/functions/generate-blog-post-from-topic/index.ts`, `src/__tests__/regression/topic-generation-non-portuguese-source.test.ts` (novo), `docs/TESTING.md` (R-051).

---

### Auditoria de robustez: defesa em profundidade contra fonte de ticketing mal configurada + busca de imagem corrigida (R-048)
**Descrição:** usuário pediu confirmação de que todas as correções da "geração por tema" eram sistêmicas (valem pro cron automático, não só quando testadas manualmente). Na auditoria, 2 pontos:
1. **Busca de imagem sem resultado num dos 3 artigos de validação** ("Rock in Rio abre venda extraordinária...") — a fonte (DJ News Brasil) não tem `og:image` (confirmado via curl), e a busca de imagem (camada 2, fallback) usava o título reescrito pela IA como termo, que se afasta lexicalmente da manchete real da fonte. Corrigido: `resolveArticleImage()` agora deriva um termo do slug da própria URL da matéria e tenta esse termo antes do título editorial.
2. **Gap de robustez encontrado na auditoria** (não um bug observado, uma fragilidade): `event_sources.content_source=false` bloqueia as 3 plataformas de ticketing conhecidas hoje, mas é um campo configurado manualmente — nada no código impedia uma fonte de ticketing nova, cadastrada no futuro, de vazar pra geração se o admin esquecesse de desmarcar "Fonte de conteúdo". Adicionada uma 2ª camada independente desse campo, que rejeita qualquer candidato de domínio de ticketing conhecido ou com path de venda de ingresso, mesmo que a fonte esteja marcada errado.
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário, ao questionar se as correções eram sistêmicas)
**Impacto:** baixo (reforços aditivos — 296 testes Deno + 548 testes Vitest + typecheck, todos verdes). Auditoria confirmou: `ai_auto_generate_enabled=true`, cron do pg_cron ativo e rodando a cada hora independente de qualquer intervenção manual, `content_source` correto nas 11 fontes editoriais habilitadas.

**Arquivos alterados:** `supabase/functions/_shared/articleImage.ts`, `supabase/functions/_shared/articleImage_test.ts`, `supabase/functions/_shared/sourceArticlePicker.ts`, `supabase/functions/_shared/sourceArticlePicker_test.ts`, `docs/TESTING.md` (R-048).

---

### Hotfix: artigo gerado com 1 parágrafo só passava sem nenhuma validação de tamanho (R-048)
**Descrição:** usuário reportou que o artigo "Alok domina o Mainstage do Tomorrowland..." (gerado no teste da feature de imagem) tinha só a introdução — 312 caracteres, 1 parágrafo. O mesmo pipeline, na mesma sessão de testes, gerou outro artigo ("4x4: guia prático...") com 5624 caracteres completos — confirma que não é um problema estrutural do pipeline, é a IA parando cedo demais em alguns casos.
**Correção:** novo `_shared/articleQuality.ts` (`isContentSubstantial`/`stripHtmlTags`) exige um piso mínimo de 500 caracteres de texto real (sem HTML) antes de aceitar o artigo gerado — abaixo disso, é tratado como matéria insuficiente (mesmo mecanismo de `insufficientSources`, HTTP 422), e o `auto-article-cron` automaticamente tenta o próximo candidato da fila (Fase 1) em vez de publicar um esboço. Prompt reforçado nos dois modos deixando explícito que "tamanho proporcional" nunca autoriza 1 parágrafo só.
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário, ao reportar o artigo incompleto)
**Impacto:** baixo (validação aditiva — 289 testes Deno + 548 testes Vitest + typecheck, todos verdes)

**Arquivos alterados:** `supabase/functions/_shared/articleQuality.ts` (novo), `supabase/functions/_shared/articleQuality_test.ts` (novo), `supabase/functions/generate-blog-post-from-topic/index.ts`, `src/__tests__/contracts/edge-sugestoes-real-source-routing.test.ts`, `docs/TESTING.md` (R-048).

---

### Artigos gerados por "Geração por Tema" (matéria real) ganham imagem de capa sem IA
**Descrição:** os artigos gerados pelo novo pipeline de 1-fonte-1-matéria (R-048) nasciam sem imagem de capa — o admin pediu soluções que não envolvessem geração por IA, já que não faz sentido editorial ilustrar artificialmente a reescrita fiel de uma notícia real.
**Entrega:** novo módulo `_shared/articleImage.ts` resolve a capa em 2 camadas, nessa ordem, nunca IA: (1) `og:image`/`twitter:image` da própria página da matéria original (mesma técnica já usada em `fetch-link-metadata`, fetch puro, sem custo de API), re-hospedada no Bunny CDN (nunca hotlink direto de outro site); (2) se a fonte não tiver, busca de imagem via Firecrawl (`sources: ["images"]`, reaproveitando a `FIRECRAWL_API_KEY` já configurada — sem precisar de uma chave nova do Google) pelo tema do artigo. Se as duas falharem, o post fica sem imagem e cai no placeholder padrão do site — nunca gera nada artificialmente. Nova coluna `blog_posts.image_credit` guarda a atribuição ("Imagem: nome-da-fonte") e é exibida como legenda discreta abaixo da capa no post público; o admin também pode editar/limpar esse texto manualmente em `BlogForm.tsx`.
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário)
**Impacto:** baixo-médio (aditivo — só afeta o caminho `mode: 'source_article'`; caminho manual `open_search` mantém a geração por IA como estava) — 282 testes Deno + 547 testes Vitest + typecheck, todos verdes

**Arquivos alterados:** migração `blog_posts_image_credit` (nova coluna), `src/integrations/supabase/types.ts` (regenerado), `supabase/functions/_shared/articleImage.ts` (novo), `supabase/functions/_shared/articleImage_test.ts` (novo), `supabase/functions/generate-blog-post-from-topic/index.ts`, `src/pages/BlogPost.tsx`, `src/pages/admin/BlogManager.tsx`, `src/components/blog/BlogForm.tsx`, `docs/tabelas.md`, `docs/DATABASE_SCHEMA.md`, `docs/EDGE_FUNCTIONS.md`.

---

### Alerta de egress por e-mail nunca chegava — corrigido endpoint de envio (R-049)
**Descrição:** usuário reportou Cached Egress em 5.28GB/5GB (Free Plan) no dashboard do Supabase e pediu investigação completa. Achados: (1) o pico de 09/08 (952MB em 24h) foi um loop infinito real na aba Gestão de E-mails, já encontrado e corrigido pelo próprio usuário 20 minutos depois num commit anterior (`bdeccaf`), com teste de regressão dedicado; (2) o sistema de alerta automático (`egress-alert-cron`) já detectava os 3 picos do mês corretamente, mas nunca conseguia notificar por e-mail — 401 "Credential not found" num endpoint (`connector-gateway.lovable.dev`) que nenhuma outra função do projeto usa. Corrigido pra usar o mesmo padrão de `api.resend.com` direto já usado com sucesso em `send-test-email`/`daily-metrics-email`. Verificação pós-deploy revelou uma 2ª causa (dado, não código): `site_settings.egress_alert_email` guardava a string literal `""` em vez de um e-mail real, corrigido pra `contato@mdaccula.com` — confirmado com disparo manual real (`email_sent: true`). Adicionada uma segunda camada de proteção genérica (`adminLoadGuard`) contra qualquer causa futura de loop em loaders de admin, além da proteção específica que já existia.
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário)
**Impacto:** médio (o pico de egress em si já estava resolvido antes da investigação; o que este item corrige é o alerta que deveria ter avisado sobre ele e nunca avisou)

**Atualização (mesmo dia):** usuário viu o e-mail de alerta real chegar e reportou o layout "horrível" (HTML cru, sem estrutura). Redesenhado pra usar a mesma identidade visual do e-mail diário de métricas (tabela escura, cards, logo) — números que causaram o alerta (24h, proporção) em vermelho.

**Arquivos alterados:** `supabase/functions/egress-alert-cron/index.ts`, `supabase/functions/egress-alert-cron/resendEmail.ts` (novo), `supabase/functions/egress-alert-cron/resendEmail_test.ts` (novo), `supabase/functions/egress-alert-cron/emailHtml.ts` (novo), `supabase/functions/egress-alert-cron/emailHtml_test.ts` (novo), `src/lib/adminLoadGuard.ts` (novo), `src/lib/index.ts`, `src/components/admin/emailConfig/useEmailConfigState.ts`, `src/__tests__/lib/adminLoadGuard.test.ts` (novo), `docs/TESTING.md` (R-049).

---

### Contador de views do blog/eventos filtra bots — números do e-mail diário eram inflados (R-050)
**Descrição:** usuário desconfiou dos números de acesso ao blog no e-mail diário de métricas. Investigação com dados reais confirmou: um único IP (faixa de datacenter Azure) gerava uma "view" em CADA um dos 245 posts do blog e CADA evento ativo, todo dia desde 01/08/2026 — 89% de todas as `blog_view_events` de um dia típico. `track-view` nunca olhava o `User-Agent`, só tinha um rate-limit de 10 req/min/IP que não impede um crawl lento. Corrigido com `botDetection.ts` (`isBotUserAgent`) — reconhece crawlers de busca, bots de preview de rede social, scripts/HTTP clients genéricos e headless/monitoramento; visitas de bot não incrementam mais `blog_posts.views`/`events.views` nem geram linha em `blog_view_events`/`event_view_events`, mas continuam acessando a página normalmente (sem impacto em SEO/GEO).
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário)
**Impacto:** médio (não é um bug que quebra funcionalidade — os números "reais" do site sempre estiveram certos no banco de eventos/cliques — mas o contador de views do blog estava reportando um número várias vezes maior que o tráfego humano real, distorcendo o e-mail diário e o contador público no site)

**Arquivos alterados:** `supabase/functions/track-view/index.ts`, `supabase/functions/track-view/botDetection.ts` (novo), `supabase/functions/track-view/botDetection_test.ts` (novo), `docs/TESTING.md` (R-050).

---

### Geração por Tema para de gerar artigo institucional sobre a própria fonte e passa a reescrever fielmente 1 matéria real (Fases 0+1, R-048)
**Descrição:** usuário reportou que a geração automática de artigos por tema estava "muito bugada" — investigação com dados reais do banco confirmou que os últimos rascunhos gerados ("DJ Mag LA", "Alataj", "Wonderland in Rave", "Nervous Records") eram artigos institucionais SOBRE o próprio veículo/portal fonte, não notícias reais publicadas nele, contrariando o comportamento esperado ("raspar as fontes, escolher 1 matéria real e recriar o artigo"). O usuário escolheu o Plano C (híbrido por gatilho) entre 3 alternativas apresentadas.
**Correção — Fase 0 (blindagem imediata, todos os caminhos):** `mdaccula.com`/`mdaccula.b-cdn.net` entraram no blocklist de domínios do Firecrawl; novo guardrail `_shared/selfReferentialSourceGuard.ts` descarta qualquer sugestão cujo termo de busca seja o próprio nome/domínio da fonte cadastrada — a causa raiz confirmada do padrão de bug (homepage raspada só tem branding, então a única "âncora real" extraível é o nome da marca); `generate-blog-suggestions` parou de usar a `description` da fonte como fallback silencioso quando o scraping falha; `generate-blog-post-from-topic` trocou o tamanho fixo de 900-1300 palavras por extensão proporcional e ganhou uma válvula de escape (`insufficientSources`) pra recusar gerar quando as fontes são só institucional/homepage.
**Correção — Fase 1 (pipeline estrito, só o caminho 100% automático):** novo módulo `_shared/sourceArticlePicker.ts` descobre links de matérias individuais dentro do domínio de uma fonte cadastrada (`event_sources`), filtra navegação/categoria/redes sociais/matérias já usadas antes (dedupe contra `ai_generated_posts.source_urls`) e escolhe 1 matéria nova. `generate-blog-post-from-topic` ganhou `mode: 'source_article'` — em vez de sintetizar uma busca aberta, raspa e reescreve fielmente ESSA matéria específica, com prompt dedicado que proíbe misturar outras fontes. `auto-article-cron` foi reescrito: a Etapa 1 não chama mais `generate-blog-suggestions` (que raspava homepage pra "inspiração") — agora sorteia até 3 fontes habilitadas, tenta descobrir 1 matéria nova em cada, e chama a Etapa 2 no novo modo. 404 (matéria não raspável) e 422 (matéria era só institucional) contam como skip, não como falha, preservando a lógica de contador de falhas/pausa já existente. `generate-blog-suggestions` e a busca aberta seguem existindo — agora só pro caminho manual ("Sugestões"/"Por Tema").
**Gap corrigido no caminho (fora do bug original, mas achado durante a investigação):** `AutoGenerationPanel.tsx` só exibia o intervalo de auto-geração (`ai_auto_generate_interval_hours`, 48h em produção), sem nenhuma forma de editá-lo pela UI — mudar exigia update direto no banco. Ganhou um campo editável com validação (1-720h) e botão Salvar que só aparece quando o valor muda.
**Limpeza:** os 4 rascunhos problemáticos identificados na investigação (`DJ Mag LA`, `Alataj`, `Nervous Records`, `Wonderland in Rave` — todos `published=false`, nenhum chegou a ser publicado) foram apagados do banco.
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário)
**Impacto:** médio-alto (reescreve a Etapa 1 do caminho de geração 100% automático — validado por 243 testes Deno + 545 testes Vitest + typecheck, todos verdes; recomendado acompanhar as primeiras execuções reais do cron em `docs/PENDENCIAS.md` antes de considerar totalmente estável)

**Arquivos alterados:** `supabase/functions/_shared/firecrawlSearch.ts`, `supabase/functions/_shared/firecrawlSearch_test.ts`, `supabase/functions/_shared/selfReferentialSourceGuard.ts` (novo), `supabase/functions/_shared/selfReferentialSourceGuard_test.ts` (novo), `supabase/functions/_shared/sourceArticlePicker.ts` (novo), `supabase/functions/_shared/sourceArticlePicker_test.ts` (novo), `supabase/functions/generate-blog-suggestions/index.ts`, `supabase/functions/generate-blog-post-from-topic/index.ts`, `supabase/functions/auto-article-cron/index.ts`, `src/components/admin/ai-content/AutoGenerationPanel.tsx`, `src/pages/admin/FontesManager.tsx`, `src/__tests__/regression/topic-generation-self-referential-source.test.ts` (novo), `src/__tests__/components/AutoGenerationPanelIntervalEdit.test.tsx` (novo), `src/__tests__/contracts/edge-sugestoes-real-source-routing.test.ts`, `docs/TESTING.md` (R-048), `docs/EDGE_FUNCTIONS.md`, `docs/PENDENCIAS.md`.

---

### Hotfix: Fase 1 gerava "gerei e não deu certo" quando a fonte só linkava pra página de listagem (R-048)
**Descrição:** logo após o deploy da Fase 1, o admin forçou uma geração e não saiu nenhum artigo novo, sem mensagem de erro clara ("gerei e não deu certo"). Investigação dos logs (`application_logs`) mostrou `skipped-source-article-unusable` com `source: "Play BPM"`, `sourceUrl: "https://playbpm.com.br/noticias/"`, `status: 422` — a fonte "Play BPM" tem um link de menu pra `/noticias/` na própria homepage, que passava por todos os filtros de "isso é uma matéria?" (nenhum bate padrão de raiz/categoria/tag genérico) e era escolhido como a matéria a reescrever. A IA corretamente recusou gerar (é uma página de listagem, não uma notícia — o guardrail `insufficientSources` da Fase 0 funcionou como esperado), mas isso deixou o admin sem nenhum artigo e sem entender o motivo.
**Correção:** `_shared/sourceArticlePicker.ts` ganhou `isListingIndexPath`/`LISTING_INDEX_SEGMENTS` — rejeita qualquer URL cujo path tenha 1 único segmento batendo um nome comum de seção/listagem (`noticias`, `blog`, `agenda`, `eventos`, `posts` etc., pt-BR e inglês) — e `findListingIndexUrls`, um 2º hop de descoberta: quando a raiz da fonte só linka pra páginas de listagem (sem nenhuma matéria individual visível), o `auto-article-cron` agora tenta raspar até 2 dessas páginas de listagem em busca de matérias individuais de verdade, antes de desistir dessa fonte e tentar a próxima.
**Data:** 09/08/2026 (mesmo dia da Fase 1, achado no primeiro teste real pós-deploy)
**Responsável:** IA (a pedido do usuário, ao reportar "gerei e não deu certo")
**Impacto:** baixo-médio (isolado à lógica de descoberta de links da Fase 1 — 253 testes Deno + 541 testes Vitest, todos verdes)

**Arquivos alterados:** `supabase/functions/_shared/sourceArticlePicker.ts`, `supabase/functions/_shared/sourceArticlePicker_test.ts`, `supabase/functions/auto-article-cron/index.ts`, `src/__tests__/contracts/edge-sugestoes-real-source-routing.test.ts`, `docs/TESTING.md` (R-048).

---

### Hotfix nº2: `auto-article-cron` escolhia plataforma de venda de ingresso (Sympla) como fonte de notícia (R-048)
**Descrição:** logo depois do hotfix do Play BPM, o admin forçou geração de novo e o log mostrou sucesso com `sourceName: "Sympla"` — o artigo gerado ("Transfers oficiais do Réveillon Tantrarosa 2027: horários e pontos de embarque") era a reescrita de uma página de VENDA DE INGRESSO do Sympla, não uma notícia. `event_sources` é a mesma tabela usada pelo Event Watcher (`scan-event-sources`) pra descoberta de eventos — inclui de propósito plataformas de ticketing (Sympla, Ingresse, WeGoOut) — mas nunca teve nenhuma coluna distinguindo "isso é uma fonte editorial" de "isso é só ticketing pro Event Watcher". `auto-article-cron` e `generate-blog-suggestions` podiam escolher qualquer fonte `enabled=true`, ticketing incluso.
**Correção:** migração `event_sources_content_source_flag` adiciona `content_source boolean not null default true` em `event_sources`, com `false` já aplicado nas 3 plataformas de ticketing conhecidas (Sympla, Ingresse, WeGoOut) — todas as fontes editoriais existentes mantêm `true` sem precisar de ação manual. `auto-article-cron` e `generate-blog-suggestions` passam a filtrar `.eq('content_source', true)`. `FontesManager.tsx` ganhou um toggle "Fonte de conteúdo (Geração por Tema)" por fonte, pra o admin controlar isso em cadastros futuros sem precisar de mim pra mexer no banco.
**Data:** 09/08/2026 (mesmo dia, 3º achado consecutivo pós-deploy)
**Responsável:** IA (a pedido do usuário, ao reportar que o Sympla — que ele já considerava "desativado" pra esse fim — tinha sido usado como fonte)
**Impacto:** médio (migração de schema em produção + mudança de filtro em 2 edge functions — 248 testes Deno + 542 testes Vitest + typecheck, todos verdes; os 2 rascunhos ruins gerados nos testes pós-deploy foram apagados)

**Arquivos alterados:** migração `event_sources_content_source_flag` (nova, aplicada via MCP), `src/integrations/supabase/types.ts` (regenerado), `src/types/index.ts`, `src/pages/admin/FontesManager.tsx`, `supabase/functions/auto-article-cron/index.ts`, `supabase/functions/generate-blog-suggestions/index.ts`, `src/__tests__/contracts/edge-sugestoes-real-source-routing.test.ts`, `docs/TESTING.md` (R-048), `docs/tabelas.md`, `docs/DATABASE_SCHEMA.md`.

---

### Hotfix nº3: descoberta de matéria caía em página utilitária (login) — troca de estratégia negativa por positiva (R-048)
**Descrição:** logo depois do hotfix do Sympla, "House Mag" teve um link de menu pra `/login` escolhido como "a matéria" — passou pelos 3 filtros dos hotfixes anteriores (não é raiz, não é listagem conhecida, não bate nenhuma palavra do blocklist institucional). A IA recusou gerar (guardrail funcionou, nenhum post ruim saiu), mas de novo nenhum artigo saiu sem explicação clara — 3º "gerei e não deu certo" consecutivo.
**Correção:** em vez de continuar reforçando uma blocklist de palavras (login, cadastro, carrinho, minha-conta, cookies, rss... — universo sem fim, cada fonte nova pode ter uma variação não prevista), trocada a estratégia pra um sinal POSITIVO: `looksLikeArticleSlug()` exige que a URL tenha cara de matéria de verdade — último segmento do path com pelo menos 1 hífen (título real quase sempre vira slug de várias palavras) OU um segmento de ano no path (padrão universal `/2026/08/titulo-do-artigo`). Página utilitária de 1 palavra nunca tem essa forma — resolve a classe inteira do problema de uma vez, não caso a caso.
**Data:** 09/08/2026 (mesmo dia, 3º hotfix consecutivo pós-deploy — a essa altura recomendo acompanhar de perto as próximas execuções reais antes de considerar o pipeline estável)
**Responsável:** IA (a pedido do usuário)
**Impacto:** baixo-médio (isolado à lógica de descoberta de links — 253 testes Deno + 546 testes Vitest, todos verdes; nenhum post ruim foi criado neste caso, o guardrail de segurança já funcionou)

**Arquivos alterados:** `supabase/functions/_shared/sourceArticlePicker.ts`, `supabase/functions/_shared/sourceArticlePicker_test.ts`, `docs/TESTING.md` (R-048).

---

### Preview do editor de e-mail ganha seletor desktop/tablet/celular
**Descrição:** usuário pediu a possibilidade de alternar a visualização do preview do template entre desktop, tablet e celular (lembrava de ter sido implementado, mas não achou o controle na tela — investigação confirmou que nunca tinha sido implementado; o preview sempre foi fixo em 600px).
**Entrega:** `PreviewPanel.tsx` ganhou um `ToggleGroup` (ícones Monitor/Tablet/Smartphone) acima do preview que troca a largura do iframe entre 600px (desktop, padrão), 480px (tablet) e 375px (celular) — o e-mail em si continua sendo a mesma tabela de 600px, só a "janela" simulada ao redor muda, como em ferramentas de preview de e-mail (Litmus/Email on Acid). Não afeta o HTML enviado nem o download/envio de teste.
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário)
**Impacto:** baixo (aditivo, só UI do editor — nenhuma mudança em como o e-mail é composto ou enviado)

**Arquivos alterados:** `src/components/admin/emailTemplateEditor/PreviewPanel.tsx`, `src/__tests__/components/PreviewPanelDeviceToggle.test.tsx`.

---

### Bloco "Ticker de urgência" (modo fade) causava scroll horizontal no preview com 2-3 mensagens (R-047)
**Descrição:** usuário reportou que o preview do novo template "Promoção" tinha uma barra de rolagem horizontal, diferente dos demais templates.
**Correção:** o CSS do modo `fade` do bloco `ticker` (`renderInteractiveBlock`, `case "ticker"`) deixava as 3 mensagens com `display:inline` simultaneamente (bug de especificidade CSS — a troca dependia só da animação de opacidade, mas as mensagens continuavam ocupando espaço lado a lado, sem separador, num container `white-space:nowrap`, estourando os 600px da tabela do e-mail). Os spans passaram a usar `position:absolute` empilhados, então só a opacidade decide qual mensagem aparece, sem nenhuma ocupar espaço junto com as outras. Só o modo "Cortesia"/"Novo evento" (sem `ticker`) não tinha o bug; o preset "Promoção" foi o primeiro a combinar `ticker` fade com múltiplas mensagens.
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário)
**Impacto:** baixo (bug visual isolado ao bloco ticker em modo fade; correção aditiva, sem mudar o HTML de outros modos de animação)

**Arquivos alterados:** `supabase/functions/_shared/emailBlocks/renderBlock/interactive.ts`, `supabase/functions/_shared/emailBlocks_test.ts`, `docs/TESTING.md` (R-047).

---

### Novo tipo de template de e-mail "Promoção" (desconto pontual por evento)
**Descrição:** usuário pediu um template de e-mail dedicado a promoções pontuais de um evento específico (ex.: "40% off só hoje"), reaproveitando os blocos já existentes do editor — em especial o bloco de texto livre, onde o admin digita a copy específica do desconto. Também reportou que o bloco de texto não quebrava linha ao apertar Enter; investigação (com reprodução ao vivo no navegador, digitando e apertando Enter no editor real) confirmou que esse comportamento já havia sido corrigido pelo commit anterior (`a69d94e`, 08/08 — margem inline entre `<p>`s do Tiptap) e não reproduz mais — nenhuma alteração de código foi necessária ali.
**Entrega:** novo tipo dedicado `email_templates.type = 'promo'` (migration alterando o `CHECK` da coluna) com preset `event_promo` em `TEMPLATE_PRESETS`: cabeçalho, flyer, etiqueta de destaque, título, data/hora/local, contagem regressiva (`countdown`, prazo configurável), bloco de texto livre para a copy da promoção, ticker de urgência, botão CTA, divisor, redes sociais e rodapé. Tipo propagado por toda a cadeia que já tratava tipos de template — filtro do editor (Passo 1), rótulos compartilhados, envio manual (lista + filtro de blocos exclusivos de evento único) e tag de campanha na E-goi (`promocao`). Testado de ponta a ponta no admin local: criação pelo preset, edição do bloco de texto, preview e listagem na aba de Envio Manual.
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário, plano aprovado antes da execução)
**Impacto:** baixo-médio (aditivo — não muda templates existentes; abre um novo tipo no editor e no envio manual)

**Arquivos alterados:** `supabase/migrations/20260809130000_email_templates_promo_type.sql`, `src/lib/emailTemplates/presetBuilders.ts`, `src/lib/emailTemplates/presetsCatalog.ts`, `src/lib/emailTemplates/blocks.ts`, `src/lib/emailTemplates/typeLabels.ts`, `src/lib/emailTemplates/dispatchEventDraft.ts`, `src/components/admin/emailTemplateEditor/typeFilter.ts`, `src/components/admin/EmailTemplateEditor.tsx`, `src/components/admin/emailConfig/useManualBatch.ts`, `src/components/admin/emailConfig/ManualSendTab.tsx`, `supabase/functions/create-event-email-campaign/index.ts`, `src/__tests__/lib/presetBuilders-event-promo.test.ts`, `docs/tabelas.md`.

---

### Grid de eventos ganha título sobre a imagem, line-up e colunas configuráveis (2/3) + assunto multi-evento usa nomes reais (R-046)
**Descrição:** usuário reportou que, nos templates "Virada de lote — múltiplos eventos" e "FDS sem taxa — múltiplos eventos", o assunto/H1 do e-mail sempre mostrava a frase genérica "N eventos com novo lote hoje" em vez dos nomes reais dos eventos selecionados, e que o grid de imagens não deixava o nome do evento claro o suficiente (queria ele em destaque, sobreposto à imagem, como nos templates de evento único). Pediu também poder escolher entre grid de 2 ou 3 colunas no editor.
**Correção:** o assunto/preheader (`composeAutoMultiEventTitle` em `buildMultiEventAnnouncementData`) passou a usar os títulos reais dos eventos ("A", "A e B", "A, B e C") quando cabem numa linha; se não couberem, cai direto na frase genérica antiga (sem etapa intermediária tipo "Primeiro e mais N eventos" — testada e descartada por ficar com leitura estranha). Separadamente, o bloco "Título" (H1, corpo do e-mail) passou a listar TODOS os eventos, um por linha com marcador + dia/hora (ex.: "• BOMA presents: The Moment — 22/08 · 17h"), já que ali — ao contrário do assunto — uma lista de verdade é possível; o override manual existente (R-037) continua tendo prioridade sobre a lista. Os cards do grid (`event_grid` e `weekend_grid` no layout "grid") ganharam um helper de renderização compartilhado: título sobreposto à imagem (mesma técnica de gradiente CSS já usada em `weekly_hero`, sem overlay real via `background`/VML — risco de quebrar no Outlook desktop), uma nova linha de line-up em chips compactos (reaproveitando o campo `events.lineup`, que já existia mas não chegava até o grid), e largura de coluna dinâmica (2 ou 3, configurável no editor, com fallback padrão de 2 pra templates salvos sem o campo).
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário, plano aprovado antes da execução; ajustado numa segunda rodada depois que o usuário não gostou do resultado do fallback "Primeiro e mais N eventos" e pediu lista completa no H1)
**Impacto:** médio-alto (visual de todo envio "múltiplos eventos" muda; assunto mostra nomes reais quando cabem, H1 sempre lista todos os eventos)

**Arquivos alterados:** `supabase/functions/_shared/emailComposer.ts`, `supabase/functions/_shared/emailBlocks/renderBlock/digest.ts`, `supabase/functions/_shared/emailBlocks/renderBlock/basic.ts`, `supabase/functions/_shared/emailBlocks/renderBlockedTemplateText.ts`, `supabase/functions/_shared/emailBlocks/types.ts`, `supabase/functions/_shared/emailBlocksLimits.ts`, `supabase/functions/weekly-digest-draft/index.ts`, `supabase/functions/_shared/weeklyDigestDraft/buildEventPayload.ts`, `supabase/functions/_shared/weeklyDigestDraft/legacyHtml.ts`, `src/components/admin/emailTemplateEditor/blockPropsPanel/digestProps.tsx`, `src/components/admin/emailTemplateEditor/blockDefaults.ts`, `src/lib/emailTemplates/blocks.ts`, `docs/TESTING.md` (R-046).

---

### Automação "Lembrete de evento" volta a disparar sozinha pelo cron (R-045)
**Descrição:** achado durante a auditoria de documentação de 09/08/2026 (comparando `list_edge_functions` do MCP contra `supabase/config.toml`): `send-event-reminder-campaigns` não tinha entrada em `config.toml`, então caía no padrão do gateway do Supabase (`verify_jwt: true`) — o cron (que só manda `x-cron-secret`, sem JWT) era bloqueado com 401 *antes* do código da function rodar. Na prática, a automação nunca disparava sozinha.
**Correção:** `[functions.send-event-reminder-campaigns]` + `verify_jwt = false` adicionado em `supabase/config.toml`, igual ao padrão de todas as outras functions de cron/webhook do projeto. Aproveitado pra deixar o comentário do arquivo explícito sobre esse padrão, pra não se repetir em functions futuras.
**Data:** 09/08/2026
**Responsável:** IA (achado durante auditoria de documentação, corrigido a pedido do usuário)
**Impacto:** alto (automação inteira não funcionava sozinha desde que foi criada)

**Arquivos alterados:** `supabase/config.toml`, `src/__tests__/regression/send-event-reminder-cron-verify-jwt-gap.test.ts` (novo), `docs/TESTING.md` (R-045), `docs/PENDENCIAS.md` (pendência correspondente removida).

---

### Blog news passa a aparecer no Dashboard de e-mails + contagem real de contatos por segmento + tooltips legíveis (R-042 a R-044)
**Descrição:** 3 melhorias pedidas pelo usuário depois de usar o Dashboard já corrigido: (1) automação "Blog news" nunca tinha uma linha em `event_email_campaigns`, então ficava invisível no Dashboard mesmo enviando normalmente na E-goi; (2) tooltip dos gráficos (Recharts) ilegível no tema escuro — texto quase-branco sobre fundo branco padrão da lib — no Dashboard de e-mails, em `/analytics` e nos gráficos de pizza de custos de IA; (3) "Alcance estimado" (aba Configuração) sempre mostrava "—" ao escolher um segmento específico.
**Correção:** `event_email_campaigns.event_id` passou a aceitar `null` (migration); `writeDigestCampaignHistory` grava 1 linha com `event_id = null` quando não há eventos, em vez de não gravar nada; `blog-digest-draft` passou a chamar essa função. Gráficos trocaram `<Tooltip />` puro por `ChartTooltip`/`ChartTooltipContent` (componente já correto usado em `egressMonitor/*`) ou ganharam `contentStyle` com tokens. `egoi-resources` passou a buscar a contagem real de contatos por segmento em `GET /lists/{id}/contacts/segment/{id}` (o objeto "Segment" da E-goi nunca tem contagem).
**Data:** 09/08/2026
**Responsável:** IA (a pedido do usuário, plano aprovado antes da execução)
**Impacto:** médio (3 telas do admin passam a mostrar dado real em vez de "—"/zerado/ilegível)

**Arquivos alterados:** `supabase/functions/_shared/digestCampaignHistory.ts`, `supabase/functions/blog-digest-draft/index.ts`, `supabase/functions/egoi-resources/index.ts`, `supabase/functions/egoi-resources/segmentCounts.ts` (novo), `src/components/admin/EmailDashboard.tsx`, `src/pages/Analytics.tsx`, `src/components/admin/AIAnalyticsDashboard.tsx`, `supabase/migrations/20260809120000_event_email_campaigns_event_id_nullable.sql`, `docs/TESTING.md` (R-042 a R-044).

---

### Métricas E-goi sempre zeradas no Dashboard + envio pra segmento específico falhava 422 (R-040, R-041)
**Descrição:** usuário reportou logo no primeiro acesso ao Dashboard (pós-auditoria de 17 fases) que as métricas de abertura/clique da E-goi apareciam tudo zeradas. Investigação ao vivo achou dois bugs reais de integração, os dois causados por endpoints/campos da API E-goi diferentes do que o código assumia (nunca confirmados contra a doc oficial antes).
**Correção:** `egoi-campaign-stats` chamava `GET /campaigns/email/{id}/statistics` (não existe, 404 sempre) — corrigido pra `GET /reports/email/{hash}`, com o parser lendo os campos de dentro de `overall`; cron de sync passou a rodar em lotes paralelos com timeout de 60s (o sequencial sempre estourava os 5s padrão do pg_net). `sendEgoiCampaign` (compartilhada por 9 edge functions) enviava `{ type: "segment", segment_id }` quando um segmento específico era escolhido, mas o schema real usa `{ type: "segment", data: [...] }` — causava 422 em todo envio fora do padrão "toda a lista", achado no histórico real da campanha "Keinemusik | 17/10".
**Data:** 09/08/2026
**Responsável:** IA (achado e corrigido durante conferência via Chrome do trabalho da entrada acima)
**Impacto:** alto (Dashboard de e-mails inutilizável pra métricas + qualquer envio segmentado falhando silenciosamente há tempos)

**Arquivos alterados:** `supabase/functions/egoi-campaign-stats/index.ts`, `supabase/functions/egoi-campaign-stats/parseStats.ts` (novo), `supabase/functions/_shared/egoiClient.ts`, `supabase/migrations/20260809110000_egoi_stats_cron_timeout.sql`, `src/components/admin/EmailDashboard.tsx`, `docs/TESTING.md` (R-040, R-041).

---

### Loop infinito de requisições na Gestão de E-mails (achado durante a conferência pós-auditoria)
**Descrição:** durante a checklist via Chrome que fechou a auditoria de 17 fases (entrada abaixo), a Fase 7 (sincronização de estado no preview e nos cards de automação) tinha introduzido `hydrate`/`markSaved`/`hydrateCfg` como funções não-memoizadas — repassadas pra dependency array de um `useCallback`, recriavam identidade a cada render e disparavam um loop infinito de requisições a `site_settings` (284 chamadas em segundos, várias 503).
**Correção:** as 3 funções passaram a ser `useCallback(..., [])`.
**Data:** 09/08/2026
**Responsável:** IA
**Impacto:** crítico (loop achado e corrigido antes de qualquer usuário real notar, mas martelava o projeto Supabase com centenas de requisições por minuto)

**Arquivos alterados:** `src/components/admin/emailConfig/useEmailAutomation.ts`, `src/components/admin/emailConfig/useEventReminderAutomation.ts`, `src/__tests__/regression/email-automation-hydrate-callbacks-stable-identity.test.ts` (novo).

---

### Auditoria completa da rota de Gestão de E-mails — 17 fases (10 bugs + 7 melhorias)
**Descrição:** auditoria profunda das 7 abas de `/admin/email-config`, motivada por um alerta do Lovable ("Email map returns error instead of image when Bunny CDN write hiccups") e por um pedido de levantamento de melhorias. Confirmou o bug do mapa como real (a correção anterior só blindava a leitura do cache, não a escrita) e achou mais 15 problemas (2 críticos, 3 altos, 6 médios, 4 baixos) além de 25 ideias de melhoria, executados em 17 fases pequenas e isoladas, cada uma com commit e teste próprios.
**Correção — bugs:** mapa de evento não quebra mais quando o write no Bunny CDN falha (fallback pro Storage); editor de e-mail não perde mais edição não salva ao trocar de aba do admin; corrigida corrida de duplo-envio no `force_resend` do Envio Manual; "Marcar como enviado" não esconde mais agendamento pendente; cancelar agendamento não é mais sobrescrito pelo cron em andamento; debounce ao editar bloco global (era 1 escrita por tecla); sincronização de estado no preview e nos cards de automação; "dias antes do evento" validado + fuso rotulado no agendamento manual; bucket de upload de logo limitado + copy de sanitização ajustada; rótulos de tipo de e-mail unificados + corrida corrigida no Dashboard.
**Correção — melhorias:** Dashboard mostra variação vs. período anterior e linka pro Histórico; contador X/Y no botão de atualizar métricas; avisos proativos e atalhos reais na aba Configuração; fidelidade do preview na aba Template (marca); editor de blocos com menos fricção (auto-seleção, undo/redo, busca); mais clareza no disparo do Envio manual; teste e histórico de execuções nas 4 automações.
**Data:** 08–09/08/2026
**Responsável:** IA (plano de 17 fases aprovado pelo usuário antes da execução; cada fase com commit e push próprios)
**Impacto:** alto (10 bugs reais corrigidos, incluindo 2 críticos que afetavam disparo real de e-mail; suíte de testes cresceu de 423 pra 490+)

**Arquivos alterados:** ~40 arquivos em `src/components/admin/emailConfig/`, `src/components/admin/EmailTemplateEditor.tsx`, `src/pages/admin/EmailConfig.tsx`, `supabase/functions/{create-event-email-campaign,create-multi-event-email-campaign,send-scheduled-email-campaigns}/index.ts`, migrations de banco (`egoi_config_scheduled_days_before_check`, `link_thumbnails_bucket_limits`), `docs/TESTING.md` (R-032 a R-039). Ver `git log --oneline --grep="^fix(email)\|^feat(email)"` pro detalhe fase a fase.

---

### Fase 1 de auth em Edge Functions + fix do pipeline de deploy
**Descrição:** auditoria de documentação de 03/08/2026 achou ~20 Edge Functions "só pra admin" sem NENHUMA checagem de autenticação no código (`verify_jwt` é `false` em todo o projeto — auth é responsabilidade de cada function). Ao tentar deployar a correção, descobri que o pipeline de deploy já estava quebrado antes desta sessão: a function `mcp` (auto-gerada por `@lovable.dev/mcp-js`) gera um bundle de ~26MB (a lib traz `esbuild` como dependência direta) e a API do Supabase rejeita com 413 — como o deploy antigo rodava tudo num comando só em ordem alfabética, isso travava o deploy de TODA function depois de "mcp" (inclusive as que eu estava corrigindo).
**Correção:** `send-mass-newsletter`, `import-csv-data` e `upload-csv` agora exigem admin autenticado (reaproveitando `authorizeAdminOrCron()` já existente em `_shared/index.ts`), com contract tests novos confirmando 401/403 em produção. `.github/workflows/deploy-edge-functions.yml` dividido em 2 passos — todas as functions exceto `mcp` deployam juntas; `mcp` isolada com `continue-on-error`, então uma falha nela não trava mais as outras 56.
**Data:** 04/08/2026
**Responsável:** IA (plano via skill `auditoria-backend`, aprovado pelo usuário fase a fase)
**Impacto:** alto (fecha 3 buracos reais de segurança + destrava o deploy automático de toda a infraestrutura de edge functions, que estava silenciosamente quebrado)

**Arquivos alterados:** `supabase/functions/send-mass-newsletter/index.ts`, `supabase/functions/import-csv-data/index.ts`, `supabase/functions/upload-csv/index.ts`, `.github/workflows/deploy-edge-functions.yml`, `src/__tests__/contracts/send-mass-newsletter.test.ts` (novo), `src/__tests__/contracts/import-csv-data.test.ts` (novo), `src/__tests__/contracts/upload-csv.test.ts` (novo), `docs/PENDENCIAS.md`.

---

### `docs/tabelas.md` recebe DDL retroativa de 25 tabelas (gap de documentação)
**Descrição:** auditoria de documentação de 03/08/2026 achou que `tabelas.md` (script "recriar o banco do zero") só tinha DDL de 18 das 42 tabelas reais — as 25 mais recentes (E-goi/e-mail, tracking granular, observabilidade, `event_sources`/`event_watch_drafts`) nunca tinham sido documentadas ali, e o arquivo ainda citava `news_sources`, tabela que não existe mais (substituída por `event_sources`).
**Correção:** escrita a DDL completa (colunas, tipos, PKs, FKs, CHECKs, índices, RLS policies e triggers) das 25 tabelas, levantada ao vivo via Supabase MCP e organizada nos mesmos domínios de `docs/DATABASE_SCHEMA.md`, numa nova seção "1.2-B" em `tabelas.md`. O bloco `news_sources` foi mantido (não apagado) mas marcado como obsoleto em todos os pontos onde aparece.
**Data:** 04/08/2026
**Responsável:** IA
**Impacto:** baixo-médio (documentação, não afeta código em produção; reduz risco de alguém tentar recriar o banco do zero com DDL incompleta)

**Arquivos alterados:** `docs/tabelas.md`, `docs/PENDENCIAS.md` (pendência correspondente removida).

---

### Botão "Enviar agora" na aba Automações (Digest semanal / Agenda FDS / Blog news)
**Descrição:** Antes só existia "Gerar rascunho agora" (cria na E-goi) e "Enviar teste agora" (via Resend, 1 destinatário fixo) — pra disparar de verdade pra lista inteira, o admin precisava ir manualmente na plataforma da E-goi ou ligar "Enviar automaticamente no cron" e esperar o horário agendado.
**Correção:** novo botão "Enviar agora" nos 3 cards, habilitado só quando já existe um rascunho gerado (`egoi_campaign_id`), com confirmação (`AlertDialog`) antes de disparar por ser irreversível. Nova Edge Function `send-automation-campaign-now` reaproveita `sendEgoiCampaign()` — a mesma função corrigida no bug 422 `segments.isEmpty` (R-026) — sem duplicar a montagem do payload.
**Data:** 24/07/2026
**Responsável:** IA
**Impacto:** médio (elimina um passo manual fora do sistema pra completar o envio das 3 automações)

**Arquivos alterados:** `supabase/functions/send-automation-campaign-now/index.ts` (novo), `supabase/config.toml`, `src/components/admin/emailConfig/useEmailAutomation.ts`, `src/components/admin/emailConfig/AutomationsTab.tsx`, `src/pages/admin/EmailConfig.tsx`, `src/__tests__/contracts/send-automation-campaign-now.test.ts` (novo).

---

### Top 30 dias no e-mail diário de métricas (item em destaque + card agregado)
**Descrição:** o e-mail diário já tinha "Destaques de ontem" (item mais acessado do dia) e cards de período pra 7 dias/mês atual — faltava a janela de 30 dias, tanto pro item individual quanto pro agregado.
**Correção:** `getTopEntity()` e `buildPeriodMetricResults()` (já genéricos, reaproveitados dos mecanismos de 7 dias/ontem) agora também rodam numa janela de 30 dias — novo bloco "🏆 Top do mês (30 dias)" (post/link/evento mais acessado) e novo card "Últimos 30 dias" (total agregado vs. os 30 dias anteriores).
**Data:** 24/07/2026
**Responsável:** IA
**Impacto:** baixo-médio (mais contexto no e-mail diário, sem mudança de comportamento existente)

**Arquivos alterados:** `supabase/functions/daily-metrics-email/metrics.ts`, `supabase/functions/daily-metrics-email/index.ts`, `supabase/functions/daily-metrics-email/metrics_test.ts` (5 testes novos).

---

### Favicon "revertia sozinho" pro ícone padrão do Lovable (R-028)
**Descrição:** já tinha sido corrigido uma vez (14/07/2026), mas voltava a acontecer de forma recorrente. Causa raiz: `public/service-worker.js` tratava `.ico` como imagem e servia via `cacheFirst` — a única estratégia do arquivo que nunca revalida contra a rede. Um navegador que em algum momento cacheou uma versão errada ficava preso nela para sempre, mesmo com o servidor já servindo o arquivo certo.
**Correção:** `.ico` removido de `IMAGE_PATTERNS` (cai no `networkFirst` padrão, sempre revalida) e `CACHE_VERSION` incrementado (`v13` → `v14`) pra forçar todo navegador já afetado a descartar o cache antigo na próxima visita.
**Data:** 24/07/2026
**Responsável:** IA
**Impacto:** baixo-médio (cosmético, mas recorrente e visível a qualquer visitante)

**Arquivos alterados:** `public/service-worker.js`, `src/__tests__/regression/service-worker-favicon-cache.test.ts` (novo), `docs/TESTING.md` (R-028).

---

### "Blog news" enviava artigos de eventos já encerrados (R-022)
**Descrição:** Usuário notou no e-mail Blog News de domingo (19/07) um artigo sobre o evento Krush, que era dia 17/07 — já passado e já desativado no site. A query que monta o Blog News só olhava se o post estava publicado dentro dos últimos N dias, sem nenhuma verificação sobre eventos vinculados a esses posts.
**Correção:** nova função pura `filterOutPastEventPosts` (`supabase/functions/blog-digest-draft/pastEventFilter.ts`) remove da lista qualquer post cujo(s) evento(s) vinculado(s) (via `events.blog_post_id`) já tenham passado — comparando a data (ou data final, em eventos de vários dias) contra hoje em BRT. Posts sem evento vinculado (a maioria) continuam normais. Escopo restrito ao Blog News, por decisão do usuário (não aplicado ao digest semanal, que também lista posts recentes mas de forma menos direta).
**Data:** 19/07/2026
**Responsável:** IA
**Impacto:** médio (conteúdo desatualizado/sem sentido chegando na newsletter)

**Arquivos alterados:** `supabase/functions/blog-digest-draft/pastEventFilter.ts` (novo), `supabase/functions/blog-digest-draft/pastEventFilter_test.ts` (novo, 10 testes), `supabase/functions/blog-digest-draft/index.ts`, `docs/TESTING.md` (R-022).

---

### Imagens de evento/post .webp não apareciam no Outlook nos e-mails de digest (R-021)
**Descrição:** Usuário testou "Enviar teste agora" do e-mail Blog News e reportou que fotos de eventos não apareciam no Outlook, enquanto fotos de artigo gerado por IA apareciam normalmente. Investigação encontrou que a correção pra esse exato problema já existia (`proxyForEmail()`, converte `.webp` → JPG via wsrv.nl porque o Outlook não renderiza WebP), mas só estava conectada em 2 dos 8 pontos que montam `<img>` no template de e-mail (`hero_image` e `image_with_link`). Cards de evento, posts do blog e o logo do cabeçalho usavam a URL crua — o motivo de artigos de IA "parecerem funcionar" era só que eles normalmente não são `.webp`, não porque tivessem proteção de verdade.
**Correção:** `proxyForEmail()` aplicada nos 7 pontos que faltavam em `supabase/functions/_shared/emailBlocks.ts` (`weekend_grid` × 2 layouts, `dedge_block`, `weekly_hero`, `blog_posts_list` × 2 layouts, `article_summary`, logo do `header`), e também nos 3 renderizadores de fallback legado (um em cada function de digest) que nunca tiveram essa proteção. Confirmado que "Gerar rascunho" e "Enviar teste" passam pela mesma função de render — a correção cobre os dois automaticamente. Não existe um terceiro caminho de "enviar pra todos" no código: o envio final é sempre manual, dentro do painel da E-goi, usando o HTML do rascunho já corrigido.
**Data:** 19/07/2026
**Responsável:** IA
**Impacto:** médio-alto (imagens de evento — o conteúdo principal dos e-mails de agenda — ficavam quebradas pra usuários de Outlook, um cliente de e-mail comum)

**Arquivos alterados:** `supabase/functions/_shared/emailBlocks.ts`, `supabase/functions/_shared/emailBlocks_test.ts` (9 testes novos — verificado red/green), `supabase/functions/weekly-digest-draft/index.ts`, `supabase/functions/blog-digest-draft/index.ts`, `supabase/functions/weekend-agenda-draft/index.ts`, `docs/TESTING.md` (R-021).

---

### E-mail diário de métricas: mais espaçamento e títulos maiores
**Descrição:** Ajuste de layout pedido pelo usuário depois de aprovar o conteúdo do e-mail diário de métricas (fix de R-020 + destaques + cards de período) — os cards ficavam com só 4px de espaço entre eles, muito apertado.
**Correção:** só CSS inline em `buildEmailHtml`/`buildPeriodCardHtml`/`buildHighlightsSection` (`supabase/functions/daily-metrics-email/metrics.ts`) — gap entre cards 4px→20px, padding interno maior, título principal 20px→26px, títulos de card 12px→14px. Nenhuma mudança de lógica ou dado.
**Data:** 19/07/2026
**Responsável:** IA
**Impacto:** baixo (só estética)

**Arquivos alterados:** `supabase/functions/daily-metrics-email/metrics.ts`.

---

### E-mail diário de métricas: fundo branco/fonte branca (ilegível), destaques de ontem, cards de 7 dias/mês atual e logo
**Descrição:** No primeiro e-mail real recebido (um dia após o rollout do e-mail diário de métricas), o usuário reportou layout quebrado — fundo branco em partes do corpo com texto na cor clara pensada pro fundo escuro, tornando várias partes ilegíveis. Causa raiz: `buildEmailHtml` (`supabase/functions/daily-metrics-email/metrics.ts`) devolvia um `<div>` solto com `background` só via CSS inline, sem nenhum wrapper `<!doctype html><html><head><body>` — Outlook desktop ignora `background` em `<div>`, e clientes com auto-dark-mode (Apple Mail/Gmail) podem inverter cores parcialmente sem um `<meta name="color-scheme">` declarado. As outras funções de e-mail do projeto já seguiam o padrão correto (HTML completo + tabelas com `bgcolor`); só essa function (nova nesta mesma sessão) tinha o gap. Junto com o fix, o usuário pediu 4 melhorias: seção com o artigo/link/evento mais acessado de ontem, um card com o total dos últimos 7 dias, um card com o total do mês atual (ambos comparando com o mesmo período anterior), e o logo da MDAccula no topo.
**Correção:** `buildEmailHtml` reescrito com estrutura table-based completa (`<html><head>` com `color-scheme`/`supported-color-schemes` dark, `<body>`/`<table>` com `bgcolor` e `background-color` redundantes) — mesmo padrão já usado em `weekly-digest-draft/index.ts`. Novo `findMostFrequent` (`metrics.ts`) + `getTopEntity` (`index.ts`) calculam artigo/link/evento mais acessado de ontem contando ocorrências em memória (volume diário baixo, sem precisar de `GROUP BY` no banco). Novo `getBRTMonthToDateWindows` calcula a janela do mês atual (dia 1 até ontem) e a janela equivalente do mês anterior (mesmo número de dias, truncando quando o mês anterior é mais curto, ex.: 31/03 vs. até 28/02, e cruzando o ano corretamente). Novo `formatBRTDateRange` formata os rótulos "dd/mm – dd/mm" dos cards. Logo (`https://mdaccula.com/logo-mdaccula.jpeg`, mesmo asset já usado como `og:image`) adicionado no topo. Todo texto vindo de dados (rótulos, nomes de destaques) agora passa por `escapeHtml`.
**Data:** 19/07/2026
**Responsável:** IA
**Impacto:** alto (e-mail diário fica ilegível pro destinatário até esta correção)

**Arquivos alterados:** `supabase/functions/daily-metrics-email/metrics.ts`, `supabase/functions/daily-metrics-email/index.ts`, `supabase/functions/daily-metrics-email/metrics_test.ts` (28 testes no total — verificado red/green que o teste de layout falha sem o wrapper completo), `docs/TESTING.md` (R-020).

---

### SEO: og:title/og:description/twitter:*/meta description/canonical nunca mudavam por rota
**Descrição:** Achado durante o teste manual do prerender (rodada anterior): `document.title` mudava corretamente por rota, mas `og:title`/`og:description`/`twitter:title`/`twitter:description`/`meta name="description"`/`link rel="canonical"` ficavam sempre com o texto genérico do site inteiro — compartilhar um link de evento no WhatsApp/Facebook/Instagram mostrava o preview genérico, não o do evento; o Google também via a `meta description` errada em qualquer rota. Causa raiz confirmada com teste real contra o site publicado: existiam **duas** tags `og:title` no DOM final — a genérica de `index.html` (sem `data-rh`) e a correta da rota (com `data-rh="true"`, gerada por `SEOHead.tsx`/react-helmet-async). O Helmet só reconhece e substitui `<meta>`/`<link>` que já tenham esse atributo (confirmado lendo o código-fonte da lib) — sem ele nas tags estáticas, o Helmet nunca as via e só empilhava a versão real ao lado da genérica, nunca removendo a antiga.
**Correção:** `index.html` ganhou `data-rh="true"` em todas as tags que `SEOHead.tsx` também gerencia — agora o Helmet as reconhece como próprias e as substitui de verdade no primeiro render.
**Data:** 19/07/2026
**Responsável:** IA
**Impacto:** alto (afeta todo compartilhamento social e o snippet do Google em qualquer página do site, não só as cobertas pelo prerender)

**Arquivos alterados:** `index.html`, `src/__tests__/regression/seohead-static-tag-duplication.test.tsx` (novo — verificado red/green que o teste falha sem o `data-rh`, provando que pega a regressão de verdade).

---

### Guardrail de raspagem sem fonte real, marca automática em imagens e prerender SEO (Fase 4)
**Descrição:** Continuação direta da rodada anterior — ao testar a correção de roteamento de sugestões (R-017), o usuário gerou manualmente dois artigos de evento ("A Liga", "Solomun") pela aba **Gerar** com o template "Raspagem de Eventos" e ambos saíram com conteúdo totalmente inventado, publicados até serem despublicados durante a investigação (ver R-018 em `docs/TESTING.md`). Três frentes:
1. **Guardrail de conteúdo (R-018):** `generate-blog-post-v2` agora exige uma busca real via Firecrawl antes de gerar um artigo de evento sem dado real por trás (`isEventMode && !hasEventSignals`) — sem fonte encontrada, nenhum artigo é criado. `searchWithFirecrawl` foi extraída pra `supabase/functions/_shared/firecrawlSearch.ts` (compartilhada com `generate-blog-post-from-topic`). Também corrigido um gap relacionado: o frontend nunca lia a mensagem de erro real de uma Edge Function (`FunctionsHttpError.context`) — `getEdgeFunctionErrorMessage` (`src/lib/`) corrige isso em todos os handlers de geração de `AIContent2.tsx`.
2. **Marca automática em imagens:** `scan-event-sources` (Event Watcher) já aplicava a marca MDAccula (`compose-event-image`) em eventos descobertos automaticamente, mas nunca tinha agendamento `pg_cron` — mesmo padrão de bug do `egress-alert-cron` (R-013). Agendado diariamente às 08h BRT. Nova ferramenta em `/admin/settings` → Mídia pra testar `compose-event-image` manualmente (colar URL + título, ver preview antes/depois), sem depender do agendamento.
3. **Prerender SEO (Fase 4 da auditoria, achado crítico #1):** toda rota devolvia o mesmo HTML genérico da SPA pra crawlers sem JS. `scripts/prerender.mjs` + `.github/workflows/prerender.yml` geram HTML pré-renderizado via Playwright headless contra o site já publicado (`mdaccula.lovable.app`) — não um `vite preview` local, que se mostrou pouco confiável em teste manual (build local às vezes falhava a hidratar; erro não reproduzido no site real). Roda só agendado (nunca em push, pra eliminar risco de loop com o auto-sync do Lovable) e commita o resultado de volta com `[skip ci]`. Testado manualmente contra o site real: título e JSON-LD corretamente específicos por rota.

**Achado colateral (não corrigido nesta rodada, registrado em `PENDENCIAS.MD`):** `og:title`/`og:description`/`twitter:*` não mudam por rota (ficam sempre o texto genérico do site), mesmo com `document.title` correto — mais visível agora que o prerender entrega HTML real pra crawlers.

**Data:** 19/07/2026
**Responsável:** IA
**Impacto:** alto (bloqueia publicação de conteúdo fabricado já em produção; destrava SEO/compartilhamento social que dependia da Fase 4)

**Arquivos alterados:** `supabase/functions/generate-blog-post-v2/index.ts`, `supabase/functions/generate-blog-post-from-topic/index.ts`, `supabase/functions/_shared/firecrawlSearch.ts` (novo), `supabase/functions/_shared/eventSourceGuardrail.ts` (novo), `src/lib/edgeFunctionErrorMessage.ts` (novo), `src/pages/admin/AIContent2.tsx`, `src/components/admin/settings/MediaSettings.tsx`, `supabase/migrations/20260719060000_scan_event_sources_cron_schedule.sql` (novo), `scripts/prerender.mjs` (novo), `.github/workflows/prerender.yml` (novo).

---

### Lapidações: KPIs travados em 1000, template com campo opcional bloqueando geração, raspagem sem fonte real, RSS estático e fundo de ondas
**Descrição:** Lote de 6 pendências levantadas numa auditoria rápida do site, cada uma investigada com causa raiz confirmada antes de corrigir (ver R-015, R-016, R-017 em `docs/TESTING.md`):
1. **Bug:** campo marcado como opcional num template de IA (`ai_prompt_templates.required_fields`) bloqueava a geração de conteúdo como se fosse obrigatório — `AIContent2.tsx` normalizava com `Object.keys()`, descartando o `true`/`false`. Corrigido com `normalizePromptTemplateFields` (nova, em `src/lib/promptTemplateFields.ts`), que separa `allFields` (formulário) de `requiredFields` (bloqueio real).
2. **Bug:** KPIs de "Cliques em Links"/"Views em Eventos"/etc. em `/admin` → Links Analytics travavam em 1000 quando um filtro de data (hoje/7d/30d) estava ativo — `select()` sem paginação batia no teto padrão de 1000 linhas do PostgREST. Corrigido com `fetchAllPaginated` (nova, em `src/lib/supabasePagination.ts`), que pagina em blocos de 1000 até esgotar o resultado real.
3. **Bug de risco de conteúdo:** sugestões das categorias Eventos/Festivais/Lançamentos, quando geradas manualmente na aba Sugestões, caíam no template de evento sem nenhuma busca de fonte real (diferente do cron automático, que já ancorava toda categoria desde a correção de R-011) — risco de lineup/local/horário inventado. Corrigido removendo essas 3 categorias de `TEMPLATE_ROUTED_CATEGORIES`, caindo no catch-all já ancorado em busca real via `generate-blog-post-from-topic`.
4. **RSS estático:** `scripts/generate-rss.mjs` (novo, modelado em `generate-sitemap.mjs`) gera `public/rss.xml` a cada build — resolve a pendência aberta desde 14/07 do feed dinâmico (`blog-rss`) inacessível no domínio próprio.
5. **Fundo visual (teste):** `SoundWaveBackground.tsx` (novo componente, SVG/CSS puro, sem imagem/lib nova) aplicado isoladamente no hero de `EventDetail.tsx` como teste antes de considerar outras páginas — respeita `prefers-reduced-motion`.
6. **Sem mudança de código:** confirmado que "aplicar template da marca a um evento novo" já existe (`EventForm.tsx`, dropdown manual "Usar Template (opcional)" na criação) — é opcional, não automático.

**Data:** 18/07/2026
**Responsável:** IA
**Impacto:** médio (dois bugs de produção corrigidos com risco real — obrigatoriedade de template e risco de conteúdo inventado — mais duas melhorias aditivas de baixo risco)

**Arquivos alterados:** `src/pages/admin/AIContent2.tsx`, `src/components/admin/ai-content/GenerateForm.tsx`, `src/pages/admin/LinksAnalytics.tsx`, `src/pages/EventDetail.tsx`, `src/lib/promptTemplateFields.ts` (novo), `src/lib/supabasePagination.ts` (novo), `src/components/SoundWaveBackground.tsx` (novo), `scripts/generate-rss.mjs` (novo), `tailwind.config.ts`, `src/index.css`, `package.json`.

**Pendência derivada (não executada nesta rodada):** pipeline de prerender via GitHub Actions (Fase 4 da auditoria SEO) segue como decisão pendente em `PENDENCIAS.MD` — usuário pediu a especificação técnica completa antes de decidir, entregue mas ainda aguardando sinal verde.

---

### Zerar warnings do ESLint (392 → 0) e travar regras como error
**Descrição:** Limpeza completa da dívida de lint acumulada, feita em 6 fases sequenciais (cada uma commitada e validada separadamente com `tsc --noEmit` + `npm test` + coverage ratchet antes de avançar):
1. Regras triviais (consistent-type-imports, no-require-imports, no-empty, no-param-reassign, no-misleading-character-class, no-return-await, eslint-disable obsoletos) + `no-unused-vars` (66 ocorrências) + `no-console` (6, migrados pro `logger`) + `react-refresh/only-export-components` (17 de 18 — variantes `cva`, hooks de contexto e constantes extraídas pro padrão oficial shadcn/ui de arquivos irmãos).
2. `useAuth` movido para `src/hooks/useAuthContext.ts` separado do `AuthProvider`, fechando o último warning de `react-refresh` (cuidado extra: `ProtectedRoute.test.tsx` mocka esse módulo por caminho de arquivo — mock atualizado junto).
3. `react-hooks/exhaustive-deps` (24 ocorrências, 21 arquivos) — a maioria é o padrão "fetch-on-mount" (função envolvida em `useCallback` e adicionada ao array de deps, zero mudança de comportamento). **Bug real encontrado e corrigido:** em `AutoGenerationPanel.tsx`, o id do interval de polling ("Forçar geração agora") estava em `useState`; o cleanup do efeito de mount capturava sempre o valor inicial (`null`) por stale closure — se o admin saísse da tela enquanto o polling estava ativo, o interval nunca era limpo (chamava `fetchData` a cada 10s por até 5min contra um componente desmontado). Trocado para `useRef`.
4. `no-explicit-any` em catch/error handlers (82 ocorrências, 28 arquivos) — `catch (e: any)` → `catch (e: unknown)` + narrowing (`instanceof Error`), via codemod one-off que localiza o bloco por profundidade de chaves (ciente de strings/comentários) e só insere a narrowing line quando `.message` é de fato acessado.
5. `no-explicit-any` em respostas do Supabase (49 ocorrências) — os 27 casts `(supabase.from as any)("tabela")` espalhados pelo código estavam **obsoletos**: todas as tabelas já tinham tipo gerado em `types.ts` (alguém regenerou o arquivo depois que os workarounds foram escritos, mas ninguém tirou os `as any`). Confirmado removendo um por um com `tsc --noEmit` limpo a cada passo.
6. `no-explicit-any` restante (121 ocorrências, 27 arquivos) — principalmente o editor visual de blocos de e-mail (`EmailTemplateEditor.tsx`, `EventForm.tsx`, `UndoMergeDialog.tsx` e afins), onde `Block` é uma union discriminada que só estreita corretamente quando o `switch`/`if` usa `block.kind === "x"` direto (não através de uma variável booleana intermediária). Achado colateral: `@/types` `Event` estava incompleto vs. o schema real de `events` (faltavam `venue_lat`, `venue_lng`, `schedule`, `ai_context`, `status` e mais — provável causa raiz de vários `any` espalhados em `EventForm`/`EventModal`/`EventsManager`), completado com os campos do `types.ts` gerado.
7. Todas as regras promovidas de `"warn"` para `"error"` em `eslint.config.js` — `npm run lint` agora falha (exit 1) numa violação nova em vez de só avisar, travando o ganho contra reacúmulo de dívida técnica.

**Data:** 18/07/2026
**Responsável:** IA
**Impacto:** médio (nenhuma mudança de comportamento visível ao usuário final; reduz risco de bug futuro por tipo incorreto e destrava o Fast Refresh em ~15 componentes de UI)

**Arquivos alterados:** ~110 arquivos ao todo (a maior parte só troca de tipo/anotação), incluindo `eslint.config.js`, `@/types/index.ts` (interface `Event` completada) e novos arquivos de contexto/variante extraídos (`*-context.ts`, `*-variants.ts`) seguindo o padrão shadcn/ui.

**Pendência conhecida:** o bug de stale closure no polling do `AutoGenerationPanel.tsx` (item 3 acima) foi corrigido mas **não ganhou teste de regressão** em `src/__tests__/regression/` — a política do projeto (`docs/TESTING.md`) pede um pra todo bug de produção corrigido; documentado como R-014 em `docs/TESTING.md`, teste ainda não escrito.

---

### Variantes de Tamanho de Imagem (thumb/medium) — Redução de Banda do Bunny CDN
**Descrição:** Investigação com dados reais (tabela `metrics_snapshots`, sem tocar credencial do Bunny) apontou a causa da banda alta: toda imagem era entregue no tamanho de upload (~570KB médio), não importa se aparecia como ícone de 64px ou capa de 1200px — média de ~337KB por requisição. Solução sem custo adicional (Bunny Optimizer pago foi descartado pelo usuário): cada upload agora gera também uma variante `thumb` (~400px) e, pra contextos de hero, uma `medium` (~800px), via convenção de nome de arquivo (`foo.webp` + `foo-thumb.webp` + `foo-medium.webp`) — sem migration, sem coluna nova no banco. URL da variante é derivada em tempo de exibição (`getThumbnailUrl`/`getMediumUrl` em `imageUtils.ts`) com cadeia de fallback (thumb/medium → full → Supabase → placeholder) pra não quebrar as imagens já existentes.
**Data:** 18/07/2026
**Responsável:** IA
**Impacto:** alto

**Rollout (7 commits, todos com push feito):**
1. Infra base: `webpConverter.ts` (`convertToWebPWithThumb`), `bunnyUploader.ts` (`uploadImageWithThumb`), Edge Function `upload-to-bunny` (aceita `baseName`/`variant`), `imageUtils.ts`
2. Links: `LinkCardImage.tsx` + uploads de `CustomLinkForm.tsx`, `LinksPageSettings.tsx`, `EventForm.tsx`
3. Grids de eventos: `Eventos.tsx`, `FeaturedEvents.tsx`, `EventsCarousel.tsx` + prop `variant` no `OptimizedImage.tsx`
4. Grids de blog + hero responsivo: `LatestNews.tsx`, `Blog.tsx`, hero de `EventDetail.tsx`/`BlogPost.tsx` com `srcset` (medium/full)
5. Busca, equipe, modal de evento: `Search.tsx`, `QuemSomos.tsx`, `EventModal.tsx`
6. Correção: `EventForm.tsx`/`RecurringEventsManager.tsx`/`EventTemplates.tsx` não geravam a variante `medium` (hero ficava sem ela) — corrigido
7. Ferramenta de backfill em `/admin/settings` → aba Mídia → "Backfill de Variantes — Eventos Ativos": gera variantes pra eventos com data futura + configs de evento recorrente (imagem compartilhada por toda instância gerada). Idempotente.

**Baseline anotado pra comparação futura:** ~337KB/requisição, ~90GB/mês, ~$4-5/mês no item de banda do Bunny (de um total de ~$10/mês que o usuário paga "pelo projeto"). Checkpoint de acompanhamento em [`PENDENCIAS.md`](PENDENCIAS.md).

---

### Fallback Inteligente de Imagens CDN
**Descrição:** Sistema de fallback em 3 camadas para imagens: Bunny CDN → Supabase Storage direto → placeholder genérico. Resolve problema de cache corrompido no CDN sem depender de purge manual.
**Data:** 15/03/2026
**Responsável:** IA
**Impacto:** alto

**Alterações:**
1. **imageUtils.ts** - Nova função `getOriginalSupabaseUrl()` reverte URL CDN para Supabase
2. **OptimizedImage.tsx** - `onError` tenta Supabase antes do gradiente
3. **Eventos.tsx** - `onError` tenta Supabase antes de `djImage`
4. **Blog.tsx** - `onError` tenta Supabase antes de `djImage`
5. **LatestNews.tsx** - Corrigida dupla chamada de `getOptimizedImageUrl`
6. **LinkCardImage.tsx** - Fallback CDN → Supabase → placeholder

**Arquivos alterados:**
- `src/lib/imageUtils.ts`
- `src/components/OptimizedImage.tsx`
- `src/pages/Eventos.tsx`
- `src/pages/Blog.tsx`
- `src/components/sections/LatestNews.tsx`
- `src/components/links/LinkCardImage.tsx`

---

### Atualização Completa da Documentação (v1.3)
**Descrição:** Auditoria e atualização de todos os 7 documentos técnicos. Versão 1.3.0, datas atualizadas para 15/03/2026, todas as features de Fase 2 documentadas, cross-references entre documentos corrigidas.
**Data:** 15/03/2026
**Responsável:** IA
**Impacto:** médio

**Documentos atualizados:**
- `README.md` - v1.3.0, 25 tabelas, 20+ edge functions, CDN section, rotas completas
- `docs/PRD.md` - Fase 2 concluída, backlog Fase 3, persona DJs
- `docs/ROADMAP.md` - Fase 2 ✅, Fase 3 iniciando com itens de engajamento
- `docs/SYSTEM-DESIGN.md` - Fluxos redirect/CDN, dual IA routing, arquitetura CDN
- `docs/SECURITY-AUDIT.md` - 25 tabelas RLS, redirect/tracking policies
- `PENDENCIAS.MD` - Entradas recentes adicionadas

---

### Otimização de Custos Cloud ($19 → estimativa $5-7/mês)
**Descrição:** Três otimizações para reduzir custos cloud: desativado persist-logs remoto, reduzido retenção de logs de 30→7 dias, cron de auto-geração alterado de 1h→6h, corrigido bug SUPABASE_URL na edge function generate-blog-suggestions.
**Data:** 18/02/2026
**Responsável:** IA
**Impacto:** alto

**Alterações:**
1. **logger.ts** - `enableRemote: false` (era `!import.meta.env.DEV`), eliminando ~742 chamadas desnecessárias à edge function persist-logs
2. **cleanup_old_logs()** - Retenção reduzida de 30 para 7 dias em application_logs e performance_metrics
3. **Cron auto-generate-article-hourly** - Alterado de `0 * * * *` (720x/mês) para `0 */6 * * *` (120x/mês), redução de 83%
4. **generate-blog-suggestions** - Corrigido bug crítico: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` não eram declarados via `Deno.env.get()` antes do uso
5. **application_logs** - Limpeza manual de registros >7 dias (835 registros removidos)

**Arquivos alterados:**
- `src/lib/logger.ts`
- `supabase/functions/generate-blog-suggestions/index.ts`

---

### Redirecionador de Links com UTM Tracking
**Descrição:** Sistema completo de links curtos (mdaccula.com/r/:slug) com redirecionamento, UTM tracking automático e contagem de cliques. Painel admin em /admin/redirects para criar, editar, ativar/desativar e monitorar links. Edge function track-redirect-click para contagem atômica.
**Data:** 15/02/2026
**Responsável:** IA
**Impacto:** alto

**Arquivos criados:**
- `supabase/functions/track-redirect-click/index.ts`
- `src/pages/Redirect.tsx`
- `src/pages/admin/RedirectsManager.tsx`

**Arquivos alterados:**
- `src/App.tsx` (rotas /r/:slug e /admin/redirects)
- `src/pages/Admin.tsx` (card no menu admin)
- `supabase/config.toml` (nova edge function)

---

### Condicional Lista VIP/Social + Fix Card Desktop
**Descrição:** Card de ingressos agora exibe "Lista VIP/Social" e "Enviar Nome para Lista" quando ticket_link contém postcontrol.com.br/mdaccula/lista. Corrigido bug onde o card sumia no desktop (faltava wrapper condicional no card `hidden lg:block`).
**Data:** 14/02/2026
**Responsável:** IA
**Impacto:** alto

---

### Roteamento Dual IA (OpenAI Direto / Gemini via Lovable)
**Descrição:** Todas as Edge Functions de IA agora respeitam o seletor de agente do admin. Modelos OpenAI usam OPENAI_API_KEY direto em api.openai.com, modelos Gemini usam LOVABLE_API_KEY via gateway Lovable AI.
**Data:** 14/02/2026
**Responsável:** IA
**Impacto:** alto

**Alterações:**
1. **generate-blog-suggestions** - Removido modelo hardcoded `google/gemini-2.5-flash`, agora lê `ai_blog_model` do settings + roteamento dual OpenAI/Gemini + temperature condicional
2. **generate-multi-event-article** - Implementado roteamento dual OpenAI/Gemini + removida dependência `imagescript` (causava erro `encodeWEBP`) + upload direto como PNG
3. **EventDetail.tsx** - Card "Ingressos com Desconto" movido para após badges de gênero no mobile (`lg:hidden`), mantido no sidebar no desktop (`hidden lg:block`)

**Arquivos alterados:**
- `supabase/functions/generate-blog-suggestions/index.ts`
- `supabase/functions/generate-multi-event-article/index.ts`
- `src/pages/EventDetail.tsx`

---

### Cron Semanal de Limpeza Automática
**Descrição:** Agendamento pg_cron semanal (domingos 4h) para cleanup-storage (imagens órfãs) e cleanup_old_logs (logs >30d). Conversão WebP já implementada no client-side via ImageUploadWithCrop.
**Data:** 11/02/2026
**Responsável:** IA
**Impacto:** alto

---

### Otimização de Storage e Banco de Dados
**Descrição:** Criação de Edge Function cleanup-storage para identificar/deletar imagens órfãs e duplicadas, seção de Manutenção no SystemHealth com botões de limpeza, e execução de cleanup de dados antigos (analytics >90d, logs, reindex)
**Data:** 11/02/2026
**Responsável:** IA
**Impacto:** alto

**Alterações:**
- Edge Function `cleanup-storage` criada (scan dry-run + limpeza real)
- Seção "Manutenção e Otimização" no SystemHealth com 4 ferramentas: limpar imagens órfãs, converter PNGs para WebP, limpar logs antigos, limpar sync logs
- Dados antigos removidos: share_analytics >90d, newsletter_popup_analytics >90d, prompt_used >30d truncado
- Índice GIN do blog_posts reindexado para compactação
- config.toml atualizado com cleanup-storage

**Arquivos criados/alterados:**
- `supabase/functions/cleanup-storage/index.ts` (NOVO)
- `src/pages/admin/SystemHealth.tsx` (MODIFICADO)
- `supabase/config.toml` (MODIFICADO)

---

### Analytics de Eventos
**Descrição:** Nova seção colapsável em /admin/links-analytics mostrando ranking de eventos por views com link direto para cada evento
**Data:** 04/02/2026
**Responsável:** IA
**Impacto:** médio

**Alterações:**
- Novo card de resumo "Views em Eventos" na grade de métricas
- Seção colapsável "Analytics de Eventos" com top 20 eventos ordenados por views
- Exibe título, venue, data e percentual do total
- Dados já populados automaticamente (usa coluna `views` existente da tabela events)

**Arquivos alterados:**
- `src/pages/admin/LinksAnalytics.tsx`

---

### Filtro de Links Fake na Geração IA
**Descrição:** IA não inventará mais URLs de ingressos falsas. Pós-processamento remove links de domínios conhecidos como fake e system prompt condiciona seção de ingressos à existência de ticketLink real.
**Data:** 04/02/2026
**Responsável:** IA
**Impacto:** alto

**Alterações:**
1. Lista de domínios fake: ticketlink.com.br, ingressos.com.br, tickets.com.br, etc.
2. Função `removeFakeLinks()` remove links <a> e URLs plaintext desses domínios
3. System prompt dinâmico: se não houver ticketLink, instrui IA a NÃO incluir seção de ingressos
4. Validação de ticketLink real antes de permitir substituição de placeholders

**Arquivos alterados:**
- `supabase/functions/generate-blog-post-v2/index.ts`

---

### Auto-conversão WebP para Thumbnails de Links
**Descrição:** Thumbnails de links agora são automaticamente convertidas para WebP no upload, reduzindo tamanho em ~70%
**Data:** 02/02/2026
**Responsável:** IA
**Impacto:** alto

**Alterações:**
- Função `uploadThumbnail` em `CustomLinkForm.tsx` agora converte automaticamente para WebP após upload
- Usa a edge function `convert-to-webp` existente (bucket: `link-thumbnails`)
- Imagens WebP e SVG são mantidas sem conversão
- Fallback gracioso: se conversão falhar, usa imagem original

**Arquivos alterados:**
- `src/components/links/CustomLinkForm.tsx`

---

### Performance: Otimização Página /links para Mobile
**Descrição:** Otimização completa da página /links para melhorar carregamento em campanhas de tráfego mobile. Redução estimada de 50% no tempo de carregamento.
**Data:** 02/02/2026
**Responsável:** IA
**Impacto:** alto

**Alterações:**
1. **Skeleton Loading** - Novo componente `LinksSkeleton.tsx` exibe feedback visual instantâneo enquanto dados carregam
2. **StaticIcon** - Substituído `DynamicIcon` (lazy import por ícone) por mapa estático com ~30 ícones comuns, eliminando waterfall
3. **Lazy DnD** - Biblioteca @dnd-kit agora carrega apenas para admins via lazy import, reduzindo bundle para visitantes
4. **Imagens Lazy** - Adicionado `loading="lazy" decoding="async"` em todos os thumbnails dos cards
5. **Query Otimizada** - Select específico no useLinks ao invés de `SELECT *`, reduzindo payload ~50%
6. **Cache localStorage** - SiteSettingsContext usa cache local com revalidação em background
7. **Service Worker v5** - Cache específico para API de links com Stale-While-Revalidate

**Métricas Esperadas:**
- FCP: 2.5s → 1.2s (-52%)
- LCP: 4.5s → 2.0s (-56%)
- TTI: 5.0s → 2.5s (-50%)

**Arquivos criados:**
- `src/components/links/LinksSkeleton.tsx`
- `src/components/links/StaticIcon.tsx`
- `src/components/links/DndWrapper.tsx`

**Arquivos alterados:**
- `src/pages/Links.tsx`
- `src/components/links/SortableLinkCard.tsx`
- `src/hooks/useLinks.ts`
- `src/contexts/SiteSettingsContext.tsx`
- `public/service-worker.js`

---

### UX Homepage e Blog: Layout Compacto
**Descrição:** 3 melhorias de UX implementadas: Hero reduzido para 85vh com espaçamentos compactos, filtros do blog atualizados com todas as categorias existentes, card de destaque reduzido ~30%
**Data:** 29/01/2026
**Responsável:** IA
**Impacto:** alto

**Alterações:**
1. **Hero** - Altura reduzida de `min-h-screen` para `min-h-[85vh]`, margens internas compactadas
2. **FeaturedEvents/LatestNews** - Padding reduzido de `py-20` para `py-12`
3. **Blog Categorias** - Adicionadas: Cultura, Lançamentos, Tecnologia, Produtores. Removidas: Guias, Entrevistas (0 posts)
4. **Card Destaque** - Imagem max h-64, título menor, excerpt 3 linhas, padding compacto

**Arquivos alterados:**
- `src/components/sections/Hero.tsx`
- `src/components/sections/FeaturedEvents.tsx`
- `src/components/sections/LatestNews.tsx`
- `src/pages/Blog.tsx`

---

### Melhorias: Sitemap, Eventos Recorrentes e Sincronização de Imagem
**Descrição:** 3 melhorias implementadas: robots.txt com sitemap correto, campos adicionais no modal de eventos recorrentes, sincronização de imagem evento→links
**Data:** 27/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
1. **robots.txt** - Sitemap agora aponta para `https://www.mdaccula.com/sitemap.xml` (acessível pelo Google)
2. **Modal Eventos Recorrentes** - Adicionados campos: Subtítulo, Endereço, Descrição, Horário de Término
3. **Sincronização de Imagem** - Ao atualizar imagem de evento, `thumbnail_url` dos links vinculados é atualizado automaticamente

**Arquivos alterados:**
- `public/robots.txt`
- `src/pages/admin/RecurringEventsManager.tsx`
- `src/components/events/EventForm.tsx`

---

### Feature: Programa de Podcast Completo
**Descrição:** Sistema completo de inscrições para programa de podcast com página pública, dashboard admin e notificações automáticas
**Data:** 23/01/2026
**Responsável:** Dev
**Impacto:** alto

**Funcionalidades implementadas:**
1. **Tabela `podcast_submissions`** - Banco de dados com 15 campos incluindo dados pessoais, projeto musical e links sociais
2. **Edge Function `send-podcast-notification`** - Envia email de confirmação ao artista e notificação detalhada à agência
3. **Tipos TypeScript** - `PodcastSubmission`, `PodcastSubmissionInsert` e `PodcastSubmissionStatus` em `src/types/index.ts`
4. **Página Pública `/MDAcculaRadio`** - Landing page com hero, "Como Funciona", "Divulgação", pricing e formulário validado com Zod
5. **Dashboard Admin `/admin/mdaccula-radio`** - Cards de métricas, tabela com filtros, dialog de detalhes, exportação CSV
6. **Navegação** - Aba "MDAcculaRadio" com ícone Mic adicionada ao header

**Arquivos criados/alterados:**
- `supabase/functions/send-podcast-notification/index.ts` (criado)
- `src/types/index.ts` (atualizado)
- `src/pages/Podcast.tsx` (criado)
- `src/pages/admin/PodcastManager.tsx` (criado)
- `src/components/ui/navigation.tsx` (atualizado)
- `src/pages/Admin.tsx` (atualizado)
- `src/App.tsx` (atualizado)

---

### Correção: Template Default e Geração de Imagem
**Descrição:** Auditoria completa e correção de 5 problemas críticos que impediam geração de sugestões e artigos
**Data:** 17/01/2026
**Responsável:** Dev
**Impacto:** crítico

**Problemas identificados e corrigidos:**
1. **Timeout da IA insuficiente (50s → 90s)**: IA abortava antes de responder, agora tem 90 segundos
2. **Modelo incorreto (openai/gpt-5 → gemini-2.5-flash)**: Forçado uso do Gemini Flash via Lovable AI Gateway (mais rápido)
3. **Excesso de fontes scrapeadas (3 → 2)**: Reduzido para deixar mais tempo para IA
4. **Timeout externo menor que interno (120s → 150s)**: `auto-article-cron` agora espera 2.5 min por sugestões
5. **Fontes duplicadas no banco**: Removidas duplicatas de House Mag e Mix Mag Brasil

**Alterações técnicas:**
- `generate-blog-suggestions`: AI_TIMEOUT=90s, MAX_SOURCES=2, logs detalhados de tempo
- `auto-article-cron`: SUGGESTIONS_TIMEOUT=150s, logs de breakdown por etapa
- Banco: `ai_blog_model` → `google/gemini-2.5-flash`, `ai_auto_generate_fail_count` → 0
- Config.toml reescrito limpo sem funções fantasma

---

### Refatoração Completa das Edge Functions de Geração de Artigos
**Descrição:** Refatoradas funções `generate-blog-suggestions` e `auto-article-cron` com timeouts adequados e removida função antiga `generate-blog-post`
**Data:** 17/01/2026
**Responsável:** Dev
**Impacto:** alto

**Problemas corrigidos:**
1. **Erro "slug: Invalid" no deploy**: Removida função `generate-blog-post` (antiga, não usada)
2. **Timeouts inadequados**: Scraping agora tem 12s por fonte, IA tem 50s
3. **Scraping sequencial lento**: Agora roda em paralelo com `Promise.all`
4. **Config.toml limpo**: Removidas entradas de funções inexistentes

**Alterações:**
- Deletado `supabase/functions/generate-blog-post/` (versão antiga)
- Refatorado `generate-blog-suggestions` com timeouts e scrape paralelo
- Refatorado `auto-article-cron` com timeouts de 2min (suggestions) e 3min (generate)
- Limpo `supabase/config.toml` sem funções fantasma

---

### Melhorias UX: Feedback Visual em Geração de Artigos
**Descrição:** Adicionado feedback visual para geração de múltiplos artigos e polling automático no dashboard
**Data:** 17/01/2026
**Responsável:** Dev
**Impacto:** médio

**Melhorias implementadas:**
1. **Barra de progresso na geração em lote**: Mostra `X de Y` artigos sendo gerados
2. **Indicação visual por artigo**: spinner, badge verde (sucesso), badge vermelho (falha)
3. **Toasts individuais**: Feedback para cada artigo (sucesso/erro) + resumo final
4. **Polling automático no Dashboard**: Atualiza a cada 10s enquanto geração está em andamento
5. **Timeout aumentado**: De 2min para 3min na edge function `auto-article-cron`

**Arquivos alterados:**
- `src/pages/admin/AIContent2.tsx`
- `src/components/admin/ai-content/SuggestionsList.tsx`
- `src/pages/admin/AutoGenerationDashboard.tsx`
- `supabase/functions/auto-article-cron/index.ts`

---

### Dashboard de Monitoramento + Correção Sistema de Sugestões/Geração Automática
**Descrição:** Corrigido bug de sugestões (keywords como string) + cron job com background tasks + dashboard de monitoramento
**Data:** 17/01/2026
**Responsável:** Dev
**Impacto:** alto

**Problemas corrigidos:**
1. **Erro `s.keywords.map is not a function`**: A IA retornava `keywords` como string, mas o frontend esperava array
2. **Timeout do Cron Job**: Função síncrona demorava demais e era cancelada pelo scheduler

**Soluções:**
1. **Normalização de dados**: `AIContent2.tsx` agora converte strings para arrays ao receber sugestões
2. **Background Tasks**: `auto-article-cron` usa `EdgeRuntime.waitUntil` para executar em background
3. **Dashboard de Monitoramento**: Nova página `/admin/auto-generation` com status, contador de falhas, histórico de execuções, botão "Forçar Geração Agora"

**Arquivos alterados:**
- `src/pages/admin/AIContent2.tsx`
- `src/components/admin/ai-content/SuggestionsList.tsx`
- `supabase/functions/auto-article-cron/index.ts`
- `src/pages/admin/AutoGenerationDashboard.tsx` (novo)
- `src/pages/Admin.tsx`
- `src/App.tsx`

---

### Bug Crítico: Geração Automática de Artigos Falhando Silenciosamente
**Descrição:** Sistema atualizava `last_run` ANTES de gerar artigo, causando falhas silenciosas (só 1 artigo em 5 dias)
**Data:** 17/01/2026
**Responsável:** Dev
**Impacto:** alto

**Problema:** O `ai_auto_generate_last_run` era atualizado ANTES de tentar gerar o artigo. Se a geração falhasse (timeout, erro API), o sistema achava que gerou e aguardava 48h para tentar novamente.

**Solução:**
1. Movido `last_run` para APÓS sucesso confirmado (post.id existe)
2. Adicionado retry automático: 1h após falha (não 48h)
3. Contador de falhas consecutivas (`ai_auto_generate_fail_count`)
4. Pausa automática após 5 falhas (24h de cooldown)
5. Logging de todos os erros em `application_logs`
6. Reset do `last_run` para forçar nova tentativa imediata

---

### Template Multi-Eventos no Editor de Prompts
**Descrição:** Prompt de artigo multi-eventos agora editável via admin + melhorias no conteúdo gerado
**Data:** 15/01/2026
**Responsável:** Dev
**Impacto:** alto

**Alterações:**
1. **Novo Template** - Categoria "Multi-Eventos" inserida em `ai_prompt_templates`
2. **Edge Function Atualizada** - `generate-multi-event-article` agora busca template do banco (com fallback)
3. **Prompt Melhorado** - Introdução extensa, cada data com 5-6 linhas, contexto dos headliners, artigo 1500-2500 palavras

---

### Gerador de Artigo Multi-Datas
**Descrição:** Novo recurso para gerar artigo consolidado de múltiplos eventos da mesma série/temporada
**Data:** 15/01/2026
**Responsável:** Dev
**Impacto:** alto

**Alterações:**
1. **Modal de Seleção** - `src/components/admin/MultiEventArticleModal.tsx` com busca, multi-seleção e preview
2. **Edge Function** - `supabase/functions/generate-multi-event-article/index.ts` com prompt especializado para séries de eventos
3. **Botão no EventsManager** - "Artigo Multi-Datas" no header da página
4. **Vinculação Automática** - Todos eventos selecionados são vinculados ao blog post gerado

---

### Virtualização + Bundle Optimization + Logger Persistência
**Descrição:** Implementados 3 itens de otimização: virtualização de listas, bundle optimization e persistência de logs
**Data:** 15/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
1. **Virtualização LinksManager** - Componente VirtualizedLinkList com @tanstack/react-virtual (ativo para >20 itens)
2. **Bundle Optimization** - vite.config.ts com LightningCSS, múltiplos passes de compressão, chunks separados para DnD e Virtual
3. **Logger Persistência** - Edge function `persist-logs` + tabelas `application_logs` e `performance_metrics` + cleanup automático 30 dias

---

### Debounce nos Filtros da Página Eventos
**Descrição:** Implementado debounce nos inputs de filtro da página Eventos
**Data:** 14/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
- Criado hook reutilizável `useDebouncedValue` em `src/hooks/useDebouncedValue.ts`
- Aplicado debounce de 300ms no campo de busca e no filtro de cidade
- Selects (gênero, estado) mantêm resposta imediata
- Hook exportado no barrel `src/hooks/index.ts`

---

### Performance: Sourcemaps + Debounce + Prefetch
**Descrição:** Implementados 3 itens de otimização de performance
**Data:** 14/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
1. **Sourcemaps Hidden** - `vite.config.ts` agora usa `sourcemap: 'hidden'` em produção
2. **Debounce SearchBar** - Adicionado debounce de 300ms na busca com hook customizado
3. **Prefetch Rotas** - Já estava implementado no navigation.tsx (onMouseEnter/onFocus)

---

### Sitemap Acessível para Google Search Console
**Descrição:** Configurado sitemap.xml estático + robots.txt com URL correta da Edge Function
**Data:** 14/01/2026
**Responsável:** Dev
**Impacto:** alto (SEO)

**Alterações:**
- Criado `public/sitemap.xml` com páginas estáticas principais
- Atualizado `robots.txt` com URL completa da Edge Function do Supabase
- Edge Function continua gerando sitemap dinâmico com posts e eventos

---

### OptimizedImage com srcset Responsivo
**Descrição:** Melhorado componente OptimizedImage com srcset para imagens responsivas
**Data:** 13/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
- Adicionado suporte a `srcset` para imagens responsivas
- Detecção automática de URLs do Supabase Storage (suporte a transformações)
- Props configuráveis: `sizes` e `widths` para customização
- Breakpoints padrão: 320, 640, 768, 1024, 1280, 1920px

---

### Service Worker Stale While Revalidate
**Descrição:** Melhorado cache strategy do Service Worker com Stale While Revalidate
**Data:** 13/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
- Atualizado para v4 com 3 caches separados (static, dynamic, images)
- Cache First para fontes e assets bundled (30 dias)
- Stale While Revalidate para imagens
- Network First para HTML
- Comando CLEAR_CACHE para limpeza manual

---

### Skeleton Loading Blog
**Descrição:** Adicionado skeleton loading na página Blog para melhor UX durante carregamento
**Data:** 13/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
- Criado componente `BlogCardSkeleton` para cards individuais
- Criado componente `BlogGridSkeleton` para grid de 6 cards
- Adicionado skeleton para seção de destaque (featured post)

---

### Migração Eventos para React Query
**Descrição:** Migrada página /eventos de useState+useEffect para React Query com cache
**Data:** 12/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
- Criado hook `src/hooks/useEvents.ts` com React Query
- Cache de 5 minutos (staleTime), garbage collection de 10 minutos (gcTime)
- Refatorado `Eventos.tsx` para usar o novo hook

---

### Lazy Loading EventsCarousel
**Descrição:** Adicionado lazy loading nas imagens do carousel de eventos
**Data:** 12/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
- Criado componente `LazyEventImage` com loading="lazy" e decoding="async"
- Substituído `backgroundImage` CSS por `<img>` com lazy loading nativo
- Placeholder gradient enquanto imagem carrega, fallback em caso de erro

---

### Consolidação Queries Blog
**Descrição:** Unificadas 2 queries separadas (featured + lista) em uma única query otimizada
**Data:** 12/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
- Removida função `fetchFeaturedPost` separada, criada função única `fetchBlogPostsWithFeatured`
- Página 1 busca PAGE_SIZE + 1 e usa primeiro post como destaque
- Reduziu de 2 requisições para 1 por carregamento de página

---

### Índice Composto Events
**Descrição:** Criado índice composto para otimizar filtros por data e localização na página de eventos
**Data:** 13/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
- Criado índice `idx_events_date_location` em (date, location_state, location_city)

---

### SiteSettingsProvider Global
**Descrição:** Criado provider global para eliminar queries duplicadas de site_settings
**Data:** 11/01/2026
**Responsável:** Dev
**Impacto:** médio

**Alterações:**
- Criado `src/contexts/SiteSettingsContext.tsx` com provider e context
- Refatorado `useSiteSettings` para re-exportar do context (compatibilidade)
- Reduzido de 5-6 queries por página para 1 única query global

---

### Correção de Policy RLS Permissiva
**Descrição:** Corrigida policy permissiva em newsletter_subscribers que usava WITH CHECK (true)
**Data:** 11/01/2026
**Responsável:** Dev
**Impacto:** alto

**Alterações:**
- Criada função `is_valid_email()` para validação de formato
- Nova policy com validação de email + tamanho máximo + source obrigatório
- Constraint de unicidade adicionado na coluna email

---

### Atualização Completa da Documentação Técnica
**Descrição:** Atualização de todos os documentos técnicos com as funcionalidades mais recentes
**Data:** 10/01/2026
**Responsável:** Sistema
**Impacto:** médio

**Documentos atualizados:** README.md, docs/PRD.md, docs/ROADMAP.md, PENDENCIAS.MD, docs/CODE_STYLE.md, docs/SECURITY-AUDIT.md

---

### Cron Job para Eventos Recorrentes D.EDGE
**Descrição:** Sistema automatizado para criar eventos semanais do D.EDGE (Moving, FreakChic, Nave, SuperAfter)
**Data:** 09/01/2026
**Responsável:** Dev
**Impacto:** alto

**Funcionalidades:**
- Tabela `recurring_event_configs` para configurar eventos recorrentes
- Edge function `create-recurring-events` executada toda terça às 03:00 BRT
- Cálculo automático da próxima data baseado no weekday configurado, verificação de duplicatas
- Página admin `/admin/recurring-events` com botão "Executar Agora" e toggle enable/disable

---

### Carousel de Eventos Mobile
**Descrição:** Cards horizontais deslizantes para próximos eventos em mobile
**Data:** 09/01/2026
**Responsável:** Dev
**Impacto:** médio

**Funcionalidades:**
- Componente `EventsCarousel` usando Embla Carousel, visível apenas em mobile (md:hidden)
- Mostra até 6 próximos eventos com imagem de fundo, data badge, gênero

---

### Preview do Prompt de Imagem no AISettings
**Descrição:** Adicionado botão de preview que mostra como o prompt fica com dados de exemplo preenchidos
**Data:** 07/01/2026
**Responsável:** Dev
**Impacto:** baixo

**Funcionalidades:**
- Botão "Preview" que abre modal com prompt renderizado, dados de exemplo realistas
- Botão "Restaurar Padrão" para voltar ao prompt original

---

### Melhoria do Prompt de Imagem Nano Banana
**Descrição:** Aprimoramento do sistema de geração de imagens para artigos automáticos e sugestões
**Data:** 07/01/2026
**Responsável:** Dev
**Impacto:** alto

**Variáveis disponíveis para prompt de imagem:** `{{title}}`, `{{summary}}`, `{{category}}`, `{{keywords}}`, `{{mood}}`, `{{visualElements}}`

---

### Reorganização Admin.tsx em Seções
**Descrição:** Agrupamento dos cards do painel admin em 4 seções visuais com headers
**Data:** 07/01/2026
**Responsável:** Dev
**Impacto:** médio

**Seções criadas:** Conteúdo (6 cards), Links & Newsletter (4 cards), Sistema (5 cards), Equipe (1 card)

---

## Índice Rápido por Mês

### Agosto 2026

| Data | Tipo | Descrição |
|------|------|-----------|
| 15/08 | Bugfix | Causa raiz definitiva do disparo de e-mail pra múltiplos eventos nunca ter funcionado — comparação de timestamp por string (R-065) |
| 15/08 | Bugfix | Mesmo sintoma do R-062 reapareceu por causa raiz diferente — escrita da Fase 1 sem timeout (R-064) |
| 15/08 | Bugfix | Mapa de e-mail e geocodificação voltaram a funcionar após rotação da chave do Google Maps quebrar o gateway do Lovable (R-063) |
| 15/08 | Segurança | Repositório ficou público — 8 segredos de cron rotacionados (`.env` permanece versionado, é lido pelo Lovable) |
| 15/08 | Bugfix | Causa raiz definitiva de eventos "presos" sem campanha e sem erro registrado + limpeza de 7 eventos afetados (R-062) |
| 10/08 | Verificação | Envio segmentado confirmado funcionando com a correção do R-059 (rascunho + envio real, 13k contatos) |
| 10/08 | Bugfix | Causa raiz definitiva de TODOS os dispatch_in_progress — PostgREST reaplicava filtro do claim sobre valor recém-gravado (R-059) |
| 10/08 | Bugfix | Causa raiz definitiva do "dispatch_in_progress" — erro real na gravação do histórico era engolido silenciosamente (R-058) |
| 10/08 | Bugfix | egoiRequest sem timeout — hipótese intermediária, insuficiente sozinha (R-057) |
| 10/08 | Bugfix | Badges do line-up coladas sem espaço no Outlook — Gmail ok (R-056) |
| 10/08 | Bugfix | Evento ficava travado ("dispatch_in_progress") sem log em falhas não previstas + fetches de mapa sem timeout (R-055) |
| 10/08 | Bugfix | Claim de disparo filtrava a própria coluna do RETURNING — causa real da coluna "ausente" (R-054) |
| 10/08 | Bugfix | Diagnóstico intermediário: recarga do cache do PostgREST, insuficiente sozinha (R-053) |
| 10/08 | Bugfix | Mensagem de erro real do disparo manual de e-mail ("Enviar agora") não chegava ao admin — aparecia só "erro de função" genérico (R-052) |
| 10/08 | Bugfix | CI/CD Pipeline (Quality Checks → ESLint) volta a passar — 8 erros pré-existentes em 3 arquivos não relacionados corrigidos |
| 10/08 | Feature | Reorganização dos controles de geração — Fase C + painel único: cooldown/streak seco no cron, checklist de qualidade final, aviso por e-mail, 8 toggles numa tela só |
| 10/08 | Feature | Reorganização dos controles de geração — Fase B: toggle rascunho/publicado em 5 caminhos, origem gravada em todo post, imagem real em Por Tema/Sugestões |
| 10/08 | Feature | Reorganização dos controles de geração — Fase A: base (settings/colunas) + Dashboard como 1ª aba de Conteúdo IA + saúde de fontes + verify-sources-weekly |
| 10/08 | Bugfix | "Sugestões"/"Por Tema" podiam gerar artigo inteiro em outro idioma quando a fonte real era estrangeira (R-051) |
| 09/08 | Feature | Artigos da Geração por Tema ganham imagem de capa sem IA (og:image da matéria + busca Firecrawl como fallback) |
| 09/08 | Bugfix | Geração por Tema para de citar a própria fonte como notícia e passa a reescrever fielmente 1 matéria real — Fases 0+1 (R-048) |
| 09/08 | Feature | Preview do editor de e-mail ganha seletor desktop/tablet/celular |
| 09/08 | Bugfix | Ticker de urgência (modo fade) causava scroll horizontal no preview (R-047) |
| 09/08 | Feature | Novo tipo de template de e-mail "Promoção" (desconto pontual por evento) |
| 09/08 | Bugfix | Automação "Lembrete de evento" volta a disparar sozinha pelo cron (R-045) |
| 09/08 | Feature | Blog news no Dashboard de e-mails + contagem real de contatos por segmento + tooltips legíveis (R-042 a R-044) |
| 09/08 | Bugfix | Métricas E-goi zeradas + envio pra segmento específico com 422 (R-040, R-041) |
| 09/08 | Bugfix | Loop infinito de requisições na Gestão de E-mails |
| 08–09/08 | Auditoria | 17 fases na rota de Gestão de E-mails (10 bugs + 7 melhorias) |

### Julho 2026

| Data | Tipo | Descrição |
|------|------|-----------|
| 18/07 | Qualidade | ESLint zerado (392 → 0 warnings), regras travadas como error |
| 18/07 | Feature | Variantes de tamanho de imagem (thumb/medium) — redução de banda Bunny CDN |

### Março 2026

| Data | Tipo | Descrição |
|------|------|-----------|
| 15/03 | Feature | Fallback inteligente de imagens CDN (3 camadas) |
| 15/03 | Docs | Atualização completa da documentação (v1.3) |

### Fevereiro 2026

| Data | Tipo | Descrição |
|------|------|-----------|
| 18/02 | Perf | Otimização de custos cloud ($19 → $5-7/mês) |
| 15/02 | Feature | Redirecionador de links com UTM tracking |
| 14/02 | Bugfix | Condicional lista VIP/social + fix card desktop |
| 14/02 | Feature | Roteamento dual IA (OpenAI/Gemini) |
| 11/02 | Feature | Cron semanal de limpeza automática |
| 11/02 | Feature | Otimização de storage e banco de dados |
| 04/02 | Feature | Analytics de eventos |
| 04/02 | Feature | Filtro de links fake na geração IA |
| 02/02 | Feature | Auto-conversão WebP para thumbnails de links |
| 02/02 | Perf | Otimização página /links para mobile |

### Janeiro 2026

| Data | Tipo | Descrição |
|------|------|-----------|
| 29/01 | UX | Layout compacto homepage e blog |
| 27/01 | Feature | Sitemap, eventos recorrentes e sincronização de imagem |
| 23/01 | Feature | Programa de podcast completo |
| 17/01 | Bugfix | Template default e geração de imagem (5 problemas críticos) |
| 17/01 | Refactor | Edge functions de geração de artigos |
| 17/01 | UX | Feedback visual em geração de artigos |
| 17/01 | Feature | Dashboard de monitoramento de geração automática |
| 17/01 | Bugfix | Geração automática falhando silenciosamente |
| 15/01 | Feature | Template multi-eventos no editor de prompts |
| 15/01 | Feature | Gerador de artigo multi-datas |
| 15/01 | Perf | Virtualização + bundle optimization + logger persistência |
| 14/01 | Perf | Debounce nos filtros da página eventos |
| 14/01 | Perf | Sourcemaps + debounce + prefetch |
| 14/01 | SEO | Sitemap acessível para Google Search Console |
| 13/01 | Feature | OptimizedImage com srcset responsivo |
| 13/01 | Perf | Service worker stale-while-revalidate |
| 13/01 | UX | Skeleton loading blog |
| 13/01 | Perf | Índice composto events |
| 12/01 | Perf | Migração eventos para React Query |
| 12/01 | Perf | Lazy loading EventsCarousel |
| 12/01 | Perf | Consolidação queries blog |
| 11/01 | Perf | SiteSettingsProvider global |
| 11/01 | Security | Correção de policy RLS permissiva |
| 10/01 | Docs | Atualização completa de documentação técnica |
| 09/01 | Feature | Cron job para eventos recorrentes D.EDGE |
| 09/01 | Feature | Carousel de eventos mobile |
| 07/01 | Feature | Prompt de imagem aprimorado (6 variáveis) |
| 07/01 | Feature | Preview do prompt de imagem no AISettings |
| 07/01 | Refactor | Reorganização Admin.tsx em seções |
| 07/01 | Refactor | AIContent2.tsx em Tabs |
| 07/01 | Bugfix | Correção global de timezone em eventos |
| 07/01 | Feature | Auditoria e correção de slugs |
| 07/01 | Bugfix | Correção de edição de posts e botão regenerar |
| 06/01 | Feature | Documentação técnica (PRD, ROADMAP) |
| 06/01 | Bugfix | Correção auto-geração de artigos |
| 06/01 | Feature | Regeneração de imagem com IA no Blog Manager |
| 06/01 | Feature | Logging centralizado |
| 06/01 | Feature | Error Boundaries em todas as páginas |
| 06/01 | Feature | Dashboard de saúde do sistema |
| 06/01 | Feature | CI/CD Pipeline GitHub Actions |
| 06/01 | Bugfix | Correção crash página Index |
| 06/01 | Security | Vulnerabilidades RLS corrigidas |
| 06/01 | Security | Rate limiting em edge functions |
| 05/01 | Feature | Ordenação manual de links |

### Dezembro 2025

| Data | Tipo | Descrição |
|------|------|-----------|
| Dez | Feature | MVP completo lançado |
| Dez | Feature | Sistema de IA para blog |
| Dez | Feature | Newsletter com A/B testing |
| Dez | Feature | Página de links (Linktree-style) |
| Dez | Feature | Painel administrativo |

---

## Documentos Relacionados

| Documento | Descrição | Link |
|-----------|-----------|------|
| PENDENCIAS.md | Itens em aberto (decisões, bugs, monitoramento) | [PENDENCIAS.md](PENDENCIAS.md) |
| ROADMAP.md | Features novas planejadas, fases e cronograma | [ROADMAP.md](ROADMAP.md) |
| README.md | Documentação técnica | [../README.md](../README.md) |
| PRD.md | Requisitos do produto | [PRD.md](PRD.md) |
| tabelas.md | Documentação do banco | [tabelas.md](tabelas.md) |

---

*Registre uma entrada nova aqui sempre que uma implementação relevante for concluída — não deixe pendurado em `PENDENCIAS.md`.*
