# Edge Functions

Índice de referência das 57 Edge Functions ativas em `supabase/functions/` (a pasta `_shared/` não conta como function — é código Deno compartilhado importado pelas demais). Contagem confirmada via `list_edge_functions` do MCP Supabase em 16/08/2026, após a remoção de `import-storage` (ferramenta de migração one-off cujo projeto de origem já não existe mais — DNS nem resolve) e `convert-to-webp` (placeholder que nunca fez a conversão de verdade, sem nenhum chamador no frontend) — ver `docs/CHANGELOG.md`.

**Todas as 57 têm `verify_jwt: false`** no gateway do Supabase — o gateway não exige JWT antes de invocar nenhuma delas. Isso significa que a autenticação real de cada function é feita manualmente dentro do próprio código: lendo o header `Authorization` e validando via `supabase.auth.getUser()` + RPC `has_role()`, checando um `x-cron-secret` contra `CRON_SHARED_SECRET`/tabela `internal_cron_secrets`, aceitando a própria `SUPABASE_SERVICE_ROLE_KEY` como Bearer (só pra chamadas server-to-server de outra Edge Function confiável), ou sendo deliberadamente pública/anônima (tracking, SEO, LGPD). A coluna **Auth** abaixo documenta o que cada function realmente faz — não o que o gateway faz.

Deploy é automático via GitHub Actions (`.github/workflows/deploy-edge-functions.yml`, CLI oficial da Supabase) a cada push em `main` que toque `supabase/functions/**` — nunca usar o deployer da Lovable UI nem o tool MCP `deploy_edge_function` como caminho normal (bug conhecido que derruba imports de `_shared/` do bundle).

## ⚠️ Gaps encontrados

A auditoria de auth admin (`docs/PENDENCIAS.md`) rodou em 8 fases entre 04/08 e 16/08/2026 e já cobriu todas as functions "só admin usa" que não tinham nenhuma checagem no código — `send-mass-newsletter`, `import-csv-data`, `upload-csv`, `cleanup-storage`, `auto-article-cron`, `create-recurring-events`, `cleanup-sync-logs`, `verify-sources-weekly`, `generate-blog-post-v2`, `generate-blog-post-from-topic`, `generate-blog-suggestions`, `generate-multi-event-article`, `regenerate-blog-image`, `preview-topic-sources`, `diagnose-media`, `batch-convert-webp`, `fetch-link-metadata`, `systemhealth` — todas exigem admin autenticado (ou cron-secret/service-role, conforme o caso) hoje. `import-storage` e `convert-to-webp` saíram da lista removidas em vez de protegidas (ver acima).

**2 casos à parte continuam sem proteção**, porque não é uma cópia mecânica do mesmo padrão: `send-podcast-notification` (chamada por formulário público real, `Podcast.tsx` — precisa de rate limiting, não admin-auth) e `compose-event-image` (2 chamadores server-to-server sem sessão de usuário, `scan-event-sources`/`apify-instagram-webhook` — precisa de secret interno compartilhado). Registrados em `docs/PENDENCIAS.md`.

---

## Tracking / Analytics

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| track-view | Registra visualização de evento ou post de blog | Frontend (anônimo) | Público | Próprio (inline) |
| track-link-click | Registra clique num link do Linktree | Frontend (anônimo) | Público | Próprio (inline) |
| track-redirect-click | Registra clique num link do redirecionador (UTM), com rate limit por IP+slug | Frontend (anônimo) | Público | Próprio (inline) |
| track-share | Registra compartilhamento de conteúdo (evento/post) por plataforma | Frontend (anônimo) | Público | Próprio (inline) |
| track-egress | Recebe batch de métricas de egress (cache hit/miss, bytes) do service worker e do edge, valida e faz upsert | Frontend/SW (anônimo) | Público | Próprio (inline) |

## E-mail / E-goi

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| create-event-email-campaign | Cria/atualiza rascunho de campanha E-goi para 1 evento (suporta A/B test e agendamento) | Frontend (admin) | Admin autenticado | Próprio (inline) |
| create-multi-event-email-campaign | Cria 1 campanha E-goi cobrindo N eventos, com claim atômico tudo-ou-nada | Frontend (admin) | Admin autenticado | Próprio (inline) |
| heal-stuck-email-dispatches | Cron a cada 5 min: resolve linhas `event_email_campaigns` presas em `in_progress` (function morta sem exceção, entre o claim e a confirmação de criação na E-goi) — marca `failed` e libera o claim do evento, com lock otimista contra reenvio manual concorrente | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| daily-metrics-email | Cron diário (08h BRT): coleta métricas do dia anterior e envia resumo por e-mail via Resend | Cron (pg_cron) | Admin ou cron secret | Padrão `_shared` |
| egoi-campaign-stats | Puxa estatísticas de uma campanha E-goi (`GET /reports/email/{hash}`) e persiste em `event_email_campaign_stats` | Frontend (admin) / Cron | Admin ou cron secret | Próprio (inline) |
| egoi-resources | Retorna listas, remetentes e segmentos da conta E-goi (somente leitura), incluindo contagem real de contatos por lista/segmento (`GET /lists/{id}/contacts/segment/{id}`) | Frontend (admin) | Admin autenticado | Próprio (inline) |
| send-automation-campaign-now | Dispara envio real de um rascunho de automação (digest/agenda/blog) já criado na E-goi | Frontend (admin) | Admin ou cron secret | Padrão `_shared` |
| send-contact-email | Envia e-mail do formulário de contato do site via Resend | Frontend (anônimo) | Público (rate limit por IP) | Próprio (inline) |
| send-mass-newsletter | Envia e-mail em massa via Resend para uma lista de destinatários | Frontend (admin) | Admin autenticado | Próprio (inline) |
| send-podcast-notification | Envia e-mails de confirmação (artista) e notificação (agência) na submissão do podcast | Frontend (formulário público) | Nenhuma ⚠️ | Próprio (inline) |
| send-event-reminder-campaigns | Poller de cron (de hora em hora) que dispara o e-mail de cada evento ativo/não-recorrente N dias antes da data (`site_settings.event_reminder_*`) | Cron (pg_cron) | Admin ou cron secret no código, mas bloqueado antes disso pelo gateway ⚠️ (ver Gaps acima) | Padrão `_shared` |
| send-scheduled-email-campaigns | Poller de cron (5 em 5 min) que dispara e-mails agendados (`event_email_campaigns.status='scheduled'`) | Cron (pg_cron) | Admin ou cron secret | Padrão `_shared` |
| send-test-email | Envia e-mail de teste do template para o próprio admin logado, via Resend | Frontend (admin) | Admin autenticado | Próprio (inline) |
| update-digest-schedule | Reconfigura os cron jobs de digest semanal/agenda FDS/blog digest a partir de `site_settings` | Frontend (admin) | Admin autenticado | Próprio (inline) |
| weekly-digest-draft | Cria rascunho de digest semanal (agenda 7 dias + posts do blog) na E-goi | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| weekend-agenda-draft | Cria rascunho da "Agenda do FDS" (eventos sex/sáb/dom) na E-goi | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| blog-digest-draft | Cria rascunho de digest só de posts do blog (sem eventos) na E-goi; registra histórico em `event_email_campaigns` com `event_id = null` (desde 09/08/2026) | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |

## Conteúdo com IA

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| generate-blog-post-v2 | Gera artigo de blog completo por IA a partir dos dados de um evento (scraping opcional + geração de imagem). `publishImmediately`/`generationSource` no body controlam rascunho-vs-publicado e o rótulo de origem gravado em `ai_generated_posts.generation_source` (item #7/#9, 10/08/2026) — chamado pela aba "Gerar", "Sugestões→template", criação/edição de evento e "Gerar artigo" por evento, e pelo Event Watcher | Frontend (admin) e scan-event-sources/apify-instagram-webhook | Admin ou service role (chamada interna) | Padrão `_shared` |
| generate-blog-post-from-topic | 2 modos: `open_search` (padrão, busca livre na web via Firecrawl a partir de um termo — usado pelo admin em "Sugestões"/"Por Tema", capa: imagem real da 1ª fonte primeiro, IA só como fallback desde 10/08/2026) ou `mode: 'source_article'` (reescrita fiel de 1 matéria específica já escolhida pelo chamador — usado só por `auto-article-cron`; capa NUNCA por IA aqui, resolvida via `_shared/articleImage.ts` em 2 camadas: og:image da matéria original, depois busca de imagem via Firecrawl). `publishImmediately`/`generationSource` no body controlam rascunho-vs-publicado e origem gravada | Frontend (admin) e auto-article-cron | Admin ou service role (chamada interna) | Próprio (inline) |
| generate-blog-suggestions | Sugere e faz scraping leve de tópicos de eventos para geração posterior de artigo (só caminho manual — `auto-article-cron` não usa mais) | Frontend (admin) | Admin autenticado | Próprio (inline) |
| generate-multi-event-article | Gera 1 artigo cobrindo múltiplos eventos relacionados (ex.: "virada de lote"). Passou a aceitar `publishImmediately` (10/08/2026, item #6 — antes sempre publicava na hora, `published: true` hardcoded); grava `generation_source: 'multi_evento'` | Frontend (admin) | Admin autenticado | Padrão `_shared` |
| compose-event-image | Aplica marca MDAccula (barra + logo) sobre uma imagem de evento e re-hospeda no Bunny | Interno (scan-event-sources/apify-instagram-webhook) e Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| regenerate-blog-image | Regera a imagem de capa de um post de blog com um novo prompt/estilo de IA | Frontend (admin) | Admin autenticado | Próprio (inline) |
| preview-topic-sources | Preview leve (sem IA) das fontes que `generate-blog-post-from-topic` encontraria para um termo | Frontend (admin) | Admin autenticado | Padrão `_shared` |
| auto-article-cron | Cron que decide automaticamente quando gerar um novo artigo de blog (controla contagem de falhas/retry). Seleção de fonte com cooldown configurável (evita repetir a mesma fonte cedo demais) e streak seco (alerta quando uma fonte fica sem matéria nova várias execuções seguidas) — item #4/#5/#6, 10/08/2026. Publica de acordo com `auto_publish_auto_cron` (chave própria, não mais compartilhada) e avisa por e-mail (`_shared/autoPublishAlert.ts`) quando publica sem revisão | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| verify-sources-weekly | Checagem semanal (segunda 09h BRT) de que cada fonte `content_source=true` ainda tem matéria nova descobrível — sem gerar nem publicar, só grava `event_sources.content_last_verified_at/ok` | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |

## Eventos

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| create-recurring-events | Cron que materializa a próxima instância de cada evento recorrente configurado, com descrição única por edição | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| scan-event-sources | Raspa fontes de eventos cadastradas (sites/Instagram via Apify), extrai por IA e cria rascunhos de artigo. Se `event_watcher_auto_publish` estiver ligado, repete a checagem de qualidade (`isContentSubstantial`) antes de publicar de fato (o insert em `generate-blog-post-v2` sempre nasce rascunho) e avisa por e-mail quando publica sem revisão — item #2/#3, 10/08/2026 | Frontend (admin) / Cron | Admin ou cron secret | Padrão `_shared` |
| apify-instagram-webhook | Recebe callback da Apify quando encontra post novo de evento no Instagram; extrai, compõe imagem e gera rascunho. Mesma checagem de qualidade + aviso por e-mail antes de publicar que scan-event-sources (item #2/#3, 10/08/2026) | Webhook externo (Apify) | Secret na query string (`internal_cron_secrets`) | Próprio (inline) |
| geocode-event | Geocodifica venue/cidade/estado de um evento via Google Maps Geocoding API e salva lat/lng | Frontend (admin) / interno / auto-geocode idempotente. Re-geocode forçado (`force: true`) disparado por `useEventFormSubmit` quando venue/cidade/estado mudam num edit — muda lat/lng, o que troca a chave de cache do mapa e força uma imagem nova | Aceita admin, service role ou anônimo (idempotente) | Próprio (inline) |

## Mídia / Storage

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| batch-convert-webp | Comprime imagens em lote (1-3 por chamada) para presets sutil/média/severa, atualizando URLs no banco | Frontend (admin) | Admin autenticado | Próprio (inline) |
| upload-to-bunny | Faz upload de uma imagem para o Bunny Storage (com dedupe por SHA-256) | Frontend (admin) | Admin autenticado | Próprio (inline) |
| migrate-to-bunny | Migra imagens do Supabase Storage para o Bunny CDN, auto-detectando a região correta | Frontend (admin) | Admin autenticado | Próprio (inline) |
| cleanup-storage | Remove arquivos órfãos/duplicados de um bucket de Storage (com modo dry-run) | Frontend (admin) | Admin autenticado | Próprio (inline) |
| diagnose-media | Diagnostica URLs de imagem no Bunny CDN quebradas/inconsistentes entre tabelas | Frontend (admin) | Admin autenticado | Próprio (inline) |
| bunny-stats | Centraliza estatísticas oficiais do Bunny (pull zone + storage zone), com cache de 5 min | Frontend (admin) | Admin autenticado | Próprio (inline) |
| fetch-link-metadata | Busca metadados Open Graph (título/imagem) de uma URL pública para preencher um link do Linktree | Frontend (admin) | Admin autenticado | Próprio (inline) |

## SEO / Público

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| sitemap | Gera `sitemap.xml` dinâmico com posts publicados e eventos ativos | Público / crawler | Público | Próprio (inline) |
| blog-rss | Gera feed RSS 2.0 dos posts publicados do blog | Público / leitor RSS | Público | Próprio (inline) |
| indexnow-notify | Notifica IndexNow (Bing/Yandex) sobre conteúdo novo; GET expõe a chave para o arquivo de verificação | Frontend (admin, ao publicar) / build | Público (chave IndexNow é pública por design) | Próprio (inline) |
| render-static-map | Proxy para Google Static Maps via connector gateway (contorna restrição de referrer da chave browser). Cache-first via `resolveMapImage` (`_shared/renderStaticMapCache.ts`): Bunny CDN → fallback Supabase Storage (bucket `event-map-images`, self-heal de volta pro Bunny) → só chama o Google em cache miss real (confirmado ausente nos dois, ou indeterminado por erro de rede nos dois). Mesma função é reusada no pré-aquecimento de campanhas (`ensureCachedMapImage`) | Frontend / clientes de e-mail | Público (`verify_jwt=false` deliberado) | Próprio (inline) |
| public-maps-config | Devolve a chave pública (referrer-restricted) do Google Maps para o navegador | Frontend | Público | Próprio (inline) |

## Admin / Import

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| import-csv-data | Importa dados em massa (eventos, posts, etc.) a partir de CSV já enviado ao Storage | Frontend (admin) | Admin autenticado | Próprio (inline) |
| upload-csv | Faz upload de um arquivo CSV bruto para o bucket de Storage (passo anterior ao import-csv-data) | Frontend (admin) | Admin autenticado | Próprio (inline) |

## Observabilidade / Sistema

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| systemhealth | Health check agregado: conexão com DB, contagem de tabelas, storage, edge functions | Frontend (admin) | Admin autenticado | Próprio (inline) |
| supabase-usage | Combina Management API (api-counts, health) com queries diretas de DB/Storage/Auth, com cache de 60s | Frontend (admin) | Admin autenticado | Próprio (inline) |
| metrics-snapshot | Cron que grava snapshot diário de métricas (Supabase + Bunny) em `metrics_snapshots` | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| egress-alert-cron | Cron diário que compara egress das últimas 24h vs. média dos 7 dias anteriores e dispara alerta por e-mail | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| persist-logs | Persiste logs de erro/warning e métricas de performance lentas enviadas pelo frontend | Frontend (anônimo) | Público | Próprio (inline) |
| cleanup-sync-logs | Cron que apaga `sync_logs` com mais de 30 dias (retenção) | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |

## LGPD

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| request-data-deletion | Recebe solicitação de exclusão de dados pessoais (LGPD) por e-mail | Frontend (formulário público) | Público (rate limit por IP: 3/hora) | Próprio (inline) |

## MCP

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| mcp | Servidor MCP auto-gerado (`@lovable.dev/mcp-js`) que expõe ferramentas somente-leitura (eventos, posts) para agentes de IA externos, usando a `anon key` internamente | Agente de IA externo (protocolo MCP) | Público (ferramentas read-only, sem auth de usuário) | Próprio (formato MCP) |

---

*Gerado a partir da leitura de todas as 58 functions em `supabase/functions/*/index.ts` + `list_edge_functions` do Supabase MCP em 03/08/2026, atualizado em 09/08/2026 (nova function `send-event-reminder-campaigns`, mudanças em `egoi-campaign-stats`/`egoi-resources`/`blog-digest-draft`, gap de `verify_jwt` encontrado).*
