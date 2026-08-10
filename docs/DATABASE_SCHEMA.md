# Database Schema

Índice de leitura rápida do schema `public` do MDAccula. Para a DDL completa (CREATE TABLE, policies RLS, triggers, funções, índices), a fonte de verdade é **[tabelas.md](tabelas.md)**.

**Contagem confirmada agora via Supabase MCP (`list_tables`): 42 tabelas no schema `public`, RLS habilitada em 100% delas.**

## ✅ Gap de DDL resolvido em 04/08/2026

`tabelas.md` agora tem DDL das 42 tabelas reais — as 25 que faltavam foram adicionadas
retroativamente na seção "1.2-B Tabelas adicionadas em 04/08/2026" de `tabelas.md` (ver entrada em
`docs/CHANGELOG.md`). O bloco `news_sources` (tabela que não existe mais — foi substituída por
`event_sources`) foi mantido no arquivo mas marcado como obsoleto em todos os pontos onde aparece.

A contagem de "18 tabelas" e as instruções de sync (`/admin/backup-sync`, ver
`docs/README-SYNC.md`) no restante de `tabelas.md` seguem sem confirmação separada — se esse fluxo
de sync externo ainda está em uso é uma pergunta em aberto, não coberta por esta correção.

---

## Conteúdo

| Tabela | Colunas principais | Chave Primária | Propósito |
|--------|--------------------|-----------------|-----------|
| blog_posts | id, title, slug, excerpt, content, category, author_id, published, published_at, views, likes, search_vector | id | Posts do blog (muitos gerados por IA a partir de eventos), com busca full-text (`search_vector`) em português |
| ai_generated_posts | id, blog_post_id (FK blog_posts), template_id (FK ai_prompt_templates), source_urls, prompt_used, model_used, input_tokens, output_tokens, total_tokens, image_tokens, generated_at | id | Metadados/auditoria de cada geração de post por IA — qual prompt e modelo foram usados e quanto custou em tokens |
| ai_prompt_templates | id, name, description, system_prompt, user_prompt_template, required_fields, is_default, category, enabled | id | Biblioteca de prompts reutilizáveis (system + user template) que alimentam a geração automática de artigos de blog |
| blog_post_likes | id, user_id, post_id (FK blog_posts), created_at | id | Registro de "curtidas" de usuários autenticados em posts do blog (unique por user+post) |

## Eventos

| Tabela | Colunas principais | Chave Primária | Propósito |
|--------|--------------------|-----------------|-----------|
| events | id, title, slug, venue, location_state, location_city, date, end_date, time, genres, lineup, ticket_link, cta_type, status, merged_into_id, blog_post_id (FK), created_by (FK profiles), venue_lat/lng, latitude/longitude, geocoded_at | id | Tabela central de eventos publicados no site — inclui suporte a festivais multi-dia (`schedule`), merge de eventos duplicados (`merged_into_id`/`status`), geocoding e disparo de e-mail de divulgação |
| event_templates | id, name, title, venue, address, location_city, location_state, genres, ticket_link, vip_link, image_url | id | Modelos reutilizáveis de evento (casa/local recorrente) para acelerar o cadastro manual de novos eventos |
| recurring_event_configs | id, name, title, venue, location_city, location_state, weekday, time, end_time, genres, ticket_link, link_group_id (FK link_groups), enabled | id | Configuração de eventos automáticos recorrentes (ex.: toda sexta-feira) — o cron gera instâncias em `events` a partir daqui |
| event_sources | id, type, name, url, enabled, content_source, last_scanned_at, last_seen_post_id | id | Fontes externas (sites/perfis) monitoradas automaticamente para descobrir novos eventos a publicar (substitui a antiga `news_sources`); `content_source=false` marca fontes que servem só o Event Watcher (ex.: Sympla, Ingresse, WeGoOut), nunca a Geração por Tema |
| event_watch_drafts | id, source_id (FK event_sources), status, extracted_title/date/time/venue/address/city/state/lineup, extracted_confidence, reviewed_by (FK profiles), published_event_id, published_blog_post_id | id | Rascunhos extraídos automaticamente de `event_sources` aguardando revisão humana antes de virarem `events`/`blog_posts` publicados |
| event_slug_redirects | old_slug, event_id (FK events), reason, created_at | old_slug | Mapeia slugs antigos de evento para o evento atual, evitando 404 quando um slug muda |

## Links/Redirect

| Tabela | Colunas principais | Chave Primária | Propósito |
|--------|--------------------|-----------------|-----------|
| link_groups | id, name, slug, display_order, enabled | id | Agrupamento visual (seções) da página estilo Linktree |
| custom_links | id, title, url, group_id (FK link_groups), event_id (FK events), thumbnail_url, is_featured, clicks, enabled, display_order, manual_order_override, override_date, override_time | id | Links individuais exibidos na página de links, com contador de cliques e opção de override manual de ordenação/data |
| redirect_links | id, slug, destination_url, description, clicks, enabled, utm_source, utm_medium, utm_campaign, utm_content | id | Encurtador/redirecionador de UTM links de campanha (`/r/slug`) com contagem de cliques agregada |

## Tracking/Analytics

| Tabela | Colunas principais | Chave Primária | Propósito |
|--------|--------------------|-----------------|-----------|
| redirect_click_events | id, redirect_link_id (FK redirect_links), clicked_at, ip_hash | id | Evento individual de clique num redirect link (granular, além do contador agregado em `redirect_links.clicks`) |
| link_click_events | id, link_id (FK custom_links), clicked_at, ip_hash | id | Evento individual de clique num link da página de links |
| blog_view_events | id, post_id (FK blog_posts), viewed_at, ip_hash | id | Evento individual de visualização de post do blog |
| event_view_events | id, event_id (FK events), viewed_at, ip_hash | id | Evento individual de visualização de página de evento |
| share_analytics | id, url, platform, shared_at, user_agent, referrer | id | Registro de compartilhamentos (share) de conteúdo por plataforma (WhatsApp, Instagram etc.) |
| newsletter_popup_analytics | id, variant_id (FK newsletter_popup_variants), session_id, user_fingerprint, event_type | id | Eventos de exibição/interação (impressão, fechamento, conversão) do popup de newsletter, por variante de teste A/B |
| egress_metrics | id, period_start, api_path, source, cache_hits, cache_misses, egress_bytes | id | Métricas agregadas de egress/banda (Supabase/Bunny) por rota e período, usadas para monitorar custo de infraestrutura |
| metrics_snapshots | day, supabase, bunny, captured_at | day | Snapshot diário consolidado de uso/custo de Supabase e Bunny CDN |

## E-mail/E-goi

| Tabela | Colunas principais | Chave Primária | Propósito |
|--------|--------------------|-----------------|-----------|
| egoi_config | id, list_id, sender_id, mode, is_enabled, scheduled_days_before, segment_id, default_event_template_id (FK email_templates), singleton | id | Configuração singleton de integração com a plataforma de e-mail marketing E-goi (lista, remetente, agendamento) |
| event_email_campaigns | id, event_id (FK events), egoi_campaign_id, status, mode, error_message, sent_at, campaign_type, ab_group_id, ab_variant, ab_test_config, scheduled_at, scheduled_send_claimed_at, segment_id | id | Uma campanha de e-mail disparada (ou agendada) na E-goi para divulgar um evento específico, com suporte a teste A/B |
| email_template_settings | id, brand_name, logo_url, primary_color, accent_color, footer_text, cta_label, instagram_url/youtube_url/tiktok_url, custom_html_header/footer, singleton | id | Configuração visual singleton (branding) aplicada a todos os templates de e-mail gerados |
| egoi_resources_cache | id, lists, senders, last_synced_at, singleton | id | Cache local singleton das listas/remetentes vindos da API da E-goi, evitando chamadas repetidas |
| email_templates | id, name, type, blocks, is_default, subject_template, preheader_template, created_by | id | Templates de e-mail (estrutura em blocos) usados para montar campanhas de divulgação |
| event_email_campaign_stats | id, campaign_id (FK event_email_campaigns), stats_json, fetched_at, updated_at | id | Estatísticas de entrega/abertura/clique de uma campanha, sincronizadas periodicamente da E-goi |
| daily_metrics_email_log | id, sent_at, metrics, email_sent, email_error | id | Log de envio do e-mail diário de métricas para a equipe (sucesso/erro do disparo) |

## Auth/Perfil

| Tabela | Colunas principais | Chave Primária | Propósito |
|--------|--------------------|-----------------|-----------|
| profiles | id (FK auth.users), full_name, phone, email | id | Dados de perfil complementares de cada usuário autenticado (espelha `auth.users`, criado via trigger `handle_new_user`) |
| user_roles | id, user_id, role (enum app_role: admin/moderator/user) | id | Papéis/permissões de usuário — fonte de verdade para `has_role()`/`is_admin()`, nunca deriva de localStorage |
| team_members | id, name, position, bio, image_url, instagram_url, display_order, active | id | Membros da equipe exibidos na página institucional ("Sobre"/Time) |

## Sistema/Infra

| Tabela | Colunas principais | Chave Primária | Propósito |
|--------|--------------------|-----------------|-----------|
| site_settings | id, key (unique), value | id | Configurações globais chave-valor do site (links sociais, WhatsApp, tema da página de links, `timezone_offset`, `event_grace_hours` etc.) |
| sync_logs | id, started_at, completed_at, status, triggered_by, tables_synced, total_records, errors, warnings, duration_seconds | id | Log de execuções do processo de sincronização com banco externo (ver `docs/README-SYNC.md`) |
| application_logs | id, level, message, error_message, context, session_id, user_agent, logged_at | id | Log centralizado de aplicação (frontend/edge functions) para o `logger` do projeto |
| performance_metrics | id, name, duration_ms, context, session_id, measured_at | id | Métricas de performance (ex.: tempo de carregamento, duração de operações) reportadas pelo frontend |
| image_hashes | hash, url, bucket, file_size, created_at | hash | Índice de hashes de imagens já enviadas ao Storage, usado para deduplicar uploads |
| internal_cron_secrets | name, secret, created_at, updated_at | name | Segredos usados para autenticar chamadas internas de cron/webhook às Edge Functions (não é acessível ao público) |
| egress_alerts | id, triggered_at, reason, api_path, source, window_bytes, baseline_bytes, ratio, threshold_mb, email_sent, email_error, details | id | Alertas disparados quando o egress/banda ultrapassa um limiar configurado, com envio de e-mail de notificação |
| email_global_blocks | id, name, description, category, block, created_by | id | Bloqueios globais de envio de e-mail (ex.: categoria/tipo de e-mail suspenso administrativamente) |

## Outros

| Tabela | Colunas principais | Chave Primária | Propósito |
|--------|--------------------|-----------------|-----------|
| newsletter_subscribers | id, email (unique), subscribed_at, confirmed, confirmation_token, unsubscribed_at, source | id | Lista de inscritos na newsletter, com fluxo de confirmação (double opt-in) e descadastro |
| newsletter_popup_variants | id, name, title, description, delay_seconds, scroll_percentage, enabled, weight | id | Variantes de teste A/B do popup de captura de newsletter (texto, gatilho de exibição, peso de distribuição) |
| podcast_submissions | id, full_name, city, phone, email, project_name, genre, project_description, has_original_track, original_track_link, instagram/spotify/soundcloud/tiktok, admin_notes, notification_sent, status | id | Inscrições de DJs no programa de podcast (formulário público), com revisão administrativa via `status`/`admin_notes` |

---

*Gerado a partir de `docs/tabelas.md` (DDL legado, 18 tabelas) + consulta ao vivo via Supabase MCP (`information_schema`, 42 tabelas) em 03/08/2026. Ver gaps no topo deste documento antes de tratar `tabelas.md` como completo.*
