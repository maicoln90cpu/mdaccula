# Edge Functions

Índice de referência das 57 Edge Functions ativas em `supabase/functions/` (a pasta `_shared/` não conta como function — é código Deno compartilhado importado pelas demais). Contagem confirmada via `list_edge_functions` do MCP Supabase.

**Todas as 57 têm `verify_jwt: false`** no gateway do Supabase — o gateway não exige JWT antes de invocar nenhuma delas. Isso significa que a autenticação real de cada function é feita manualmente dentro do próprio código: lendo o header `Authorization` e validando via `supabase.auth.getUser()` + RPC `has_role()`, checando um `x-cron-secret` contra `CRON_SHARED_SECRET`/tabela `internal_cron_secrets`, ou sendo deliberadamente pública/anônima (tracking, SEO, LGPD). A coluna **Auth** abaixo documenta o que cada function realmente faz — não o que o gateway faz.

Deploy é automático via GitHub Actions (`.github/workflows/deploy-edge-functions.yml`, CLI oficial da Supabase) a cada push em `main` que toque `supabase/functions/**` — nunca usar o deployer da Lovable UI nem o tool MCP `deploy_edge_function` como caminho normal (bug conhecido que derruba imports de `_shared/` do bundle).

## ⚠️ Gap encontrado nesta auditoria

Várias functions hoje só usadas pelo admin **não têm nenhuma checagem de autenticação no código** (o gateway já não exige JWT, e o código também não valida admin/cron secret): `send-mass-newsletter`, `import-csv-data`, `diagnose-media`, `send-podcast-notification`, `cleanup-storage`, `cleanup-sync-logs`, `auto-article-cron`, `create-recurring-events`, todas as `generate-*` de conteúdo IA, `batch-convert-webp`, `convert-to-webp`, `compose-event-image`, `regenerate-blog-image`, `fetch-link-metadata`, `import-storage`, `systemhealth`. Na prática, qualquer pessoa que descobrir a URL da function consegue chamá-la. Registrado em `docs/PENDENCIAS.md` como bug conhecido — não corrigido nesta rodada de documentação (é uma mudança de código, fora do escopo desta auditoria).

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
| daily-metrics-email | Cron diário (08h BRT): coleta métricas do dia anterior e envia resumo por e-mail via Resend | Cron (pg_cron) | Admin ou cron secret | Padrão `_shared` |
| egoi-campaign-stats | Puxa estatísticas de uma campanha E-goi e persiste em `event_email_campaign_stats` | Frontend (admin) / Cron | Admin ou cron secret | Próprio (inline) |
| egoi-curl-probe | Function descartável de debug: testa variações de header de auth contra a API E-goi | Frontend (admin, dev only) | Nenhuma | Próprio (inline) |
| egoi-resources | Retorna listas, remetentes e segmentos da conta E-goi (somente leitura) | Frontend (admin) | Admin autenticado | Próprio (inline) |
| send-automation-campaign-now | Dispara envio real de um rascunho de automação (digest/agenda/blog) já criado na E-goi | Frontend (admin) | Admin ou cron secret | Padrão `_shared` |
| send-contact-email | Envia e-mail do formulário de contato do site via Resend | Frontend (anônimo) | Público (rate limit por IP) | Próprio (inline) |
| send-mass-newsletter | Envia e-mail em massa via Resend para uma lista de destinatários | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| send-podcast-notification | Envia e-mails de confirmação (artista) e notificação (agência) na submissão do podcast | Frontend (formulário público) | Nenhuma ⚠️ | Próprio (inline) |
| send-scheduled-email-campaigns | Poller de cron (5 em 5 min) que dispara e-mails agendados (`event_email_campaigns.status='scheduled'`) | Cron (pg_cron) | Admin ou cron secret | Padrão `_shared` |
| send-test-email | Envia e-mail de teste do template para o próprio admin logado, via Resend | Frontend (admin) | Admin autenticado | Próprio (inline) |
| update-digest-schedule | Reconfigura os cron jobs de digest semanal/agenda FDS/blog digest a partir de `site_settings` | Frontend (admin) | Admin autenticado | Próprio (inline) |
| weekly-digest-draft | Cria rascunho de digest semanal (agenda 7 dias + posts do blog) na E-goi | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| weekend-agenda-draft | Cria rascunho da "Agenda do FDS" (eventos sex/sáb/dom) na E-goi | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| blog-digest-draft | Cria rascunho de digest só de posts do blog (sem eventos) na E-goi | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |

## Conteúdo com IA

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| generate-blog-post-v2 | Gera artigo de blog completo por IA a partir dos dados de um evento (scraping opcional + geração de imagem) | Frontend (admin) | Nenhuma ⚠️ | Padrão `_shared` |
| generate-blog-post-from-topic | Gera artigo de blog buscando fontes reais na web (Firecrawl) a partir de um termo de busca livre | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| generate-blog-suggestions | Sugere e faz scraping leve de tópicos de eventos para geração posterior de artigo | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| generate-multi-event-article | Gera 1 artigo cobrindo múltiplos eventos relacionados (ex.: "virada de lote") | Frontend (admin) | Nenhuma ⚠️ | Padrão `_shared` |
| compose-event-image | Aplica marca MDAccula (barra + logo) sobre uma imagem de evento e re-hospeda no Bunny | Interno (scan-event-sources/apify-instagram-webhook) e Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| regenerate-blog-image | Regera a imagem de capa de um post de blog com um novo prompt/estilo de IA | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| preview-topic-sources | Preview leve (sem IA) das fontes que `generate-blog-post-from-topic` encontraria para um termo | Frontend (admin) | Nenhuma ⚠️ | Padrão `_shared` |
| auto-article-cron | Cron que decide automaticamente quando gerar um novo artigo de blog (controla contagem de falhas/retry) | Cron (pg_cron) | Nenhuma ⚠️ | Próprio (inline) |

## Eventos

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| create-recurring-events | Cron que materializa a próxima instância de cada evento recorrente configurado, com descrição única por edição | Cron (pg_cron) | Nenhuma ⚠️ | Próprio (inline) |
| scan-event-sources | Raspa fontes de eventos cadastradas (sites/Instagram via Apify), extrai por IA e cria rascunhos de artigo | Frontend (admin) / Cron | Admin ou cron secret | Padrão `_shared` |
| apify-instagram-webhook | Recebe callback da Apify quando encontra post novo de evento no Instagram; extrai, compõe imagem e gera rascunho | Webhook externo (Apify) | Secret na query string (`internal_cron_secrets`) | Próprio (inline) |
| geocode-event | Geocodifica venue/cidade/estado de um evento via Google Maps Geocoding API e salva lat/lng | Frontend (admin) / interno / auto-geocode idempotente | Aceita admin, service role ou anônimo (idempotente) | Próprio (inline) |

## Mídia / Storage

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| convert-to-webp | Placeholder no-op: conversão real para WebP é feita client-side | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| batch-convert-webp | Comprime imagens em lote (1-3 por chamada) para presets sutil/média/severa, atualizando URLs no banco | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| upload-to-bunny | Faz upload de uma imagem para o Bunny Storage (com dedupe por SHA-256) | Frontend (admin) | Admin autenticado | Próprio (inline) |
| migrate-to-bunny | Migra imagens do Supabase Storage para o Bunny CDN, auto-detectando a região correta | Frontend (admin) | Admin autenticado | Próprio (inline) |
| cleanup-storage | Remove arquivos órfãos/duplicados de um bucket de Storage (com modo dry-run) | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| diagnose-media | Diagnostica URLs de imagem no Bunny CDN quebradas/inconsistentes entre tabelas | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| bunny-stats | Centraliza estatísticas oficiais do Bunny (pull zone + storage zone), com cache de 5 min | Frontend (admin) | Admin autenticado | Próprio (inline) |
| import-storage | Ferramenta de migração one-off: importa arquivos de um projeto Supabase antigo para o atual via manifest | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| fetch-link-metadata | Busca metadados Open Graph (título/imagem) de uma URL pública para preencher um link do Linktree | Frontend (admin) | Nenhuma (valida só que a URL é pública/segura) | Próprio (inline) |

## SEO / Público

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| sitemap | Gera `sitemap.xml` dinâmico com posts publicados e eventos ativos | Público / crawler | Público | Próprio (inline) |
| blog-rss | Gera feed RSS 2.0 dos posts publicados do blog | Público / leitor RSS | Público | Próprio (inline) |
| indexnow-notify | Notifica IndexNow (Bing/Yandex) sobre conteúdo novo; GET expõe a chave para o arquivo de verificação | Frontend (admin, ao publicar) / build | Público (chave IndexNow é pública por design) | Próprio (inline) |
| render-static-map | Proxy para Google Static Maps via connector gateway (contorna restrição de referrer da chave browser) | Frontend / clientes de e-mail | Público (`verify_jwt=false` deliberado) | Próprio (inline) |
| public-maps-config | Devolve a chave pública (referrer-restricted) do Google Maps para o navegador | Frontend | Público | Próprio (inline) |

## Admin / Import

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| import-csv-data | Importa dados em massa (eventos, posts, etc.) a partir de CSV já enviado ao Storage | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |
| upload-csv | Faz upload de um arquivo CSV bruto para o bucket de Storage (passo anterior ao import-csv-data) | Frontend (admin) | Nenhuma ⚠️ | Próprio (inline) |

## Observabilidade / Sistema

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| systemhealth | Health check agregado: conexão com DB, contagem de tabelas, storage, edge functions | Frontend (admin) / monitor externo | Nenhuma ⚠️ | Próprio (inline) |
| supabase-usage | Combina Management API (api-counts, health) com queries diretas de DB/Storage/Auth, com cache de 60s | Frontend (admin) | Admin autenticado | Próprio (inline) |
| metrics-snapshot | Cron que grava snapshot diário de métricas (Supabase + Bunny) em `metrics_snapshots` | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| egress-alert-cron | Cron diário que compara egress das últimas 24h vs. média dos 7 dias anteriores e dispara alerta por e-mail | Cron (pg_cron) | Admin ou cron secret | Próprio (inline) |
| persist-logs | Persiste logs de erro/warning e métricas de performance lentas enviadas pelo frontend | Frontend (anônimo) | Público | Próprio (inline) |
| cleanup-sync-logs | Cron que apaga `sync_logs` com mais de 30 dias (retenção) | Cron (pg_cron) | Nenhuma ⚠️ | Próprio (inline) |

## LGPD

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| request-data-deletion | Recebe solicitação de exclusão de dados pessoais (LGPD) por e-mail | Frontend (formulário público) | Público (rate limit por IP: 3/hora) | Próprio (inline) |

## MCP

| Function | Propósito | Trigger | Auth | Envelope |
|----------|-----------|---------|------|----------|
| mcp | Servidor MCP auto-gerado (`@lovable.dev/mcp-js`) que expõe ferramentas somente-leitura (eventos, posts) para agentes de IA externos, usando a `anon key` internamente | Agente de IA externo (protocolo MCP) | Público (ferramentas read-only, sem auth de usuário) | Próprio (formato MCP) |

---

*Gerado a partir da leitura de todas as 57 functions em `supabase/functions/*/index.ts` + `list_edge_functions` do Supabase MCP em 03/08/2026.*
