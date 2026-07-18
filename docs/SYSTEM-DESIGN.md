# System Design Document - MDAccula

> Arquitetura técnica, fluxos de dados, APIs e interfaces do sistema

**Versão:** 1.3  
**Data:** 17/07/2026  
**Status:** Ativo

---

## 📋 Índice

1. [Visão Arquitetural](#visão-arquitetural)
2. [Diagrama de Componentes](#diagrama-de-componentes)
3. [Fluxos de Dados](#fluxos-de-dados)
4. [APIs e Endpoints](#apis-e-endpoints)
5. [Banco de Dados](#banco-de-dados)
6. [Edge Functions](#backend-edge-functions)
7. [CDN e Imagens](#cdn-e-imagens)
8. [Autenticação e Autorização](#autenticação-e-autorização)
9. [Integrações Externas](#integrações-externas)
10. [Cache e Performance](#cache-e-performance)
11. [Segurança](#segurança)

---

## Visão Arquitetural

### Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTE (Browser)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  React SPA │ React Router │ TanStack Query │ Tailwind │ Framer Motion │ SW  │
│  (lazy loading de todas as páginas via React.lazy + Suspense)               │
└─────────────────────────────────────────────────────────────────────────────┘
                          │                    │
                          ▼                    ▼
┌──────────────────────────────┐  ┌────────────────────────────────────────────┐
│      BUNNY CDN               │  │          LOVABLE CLOUD (Supabase)           │
│      cdn.mdaccula.com        │  ├──────────┬──────────┬──────────┬───────────┤
│  ┌─────────────────────┐     │  │PostgreSQL│ Edge Fn  │ Storage  │  Auth     │
│  │ Origin: Supabase    │     │  │ 25 tabelas│ 20+ fn  │ 3 buckets│ JWT+RBAC │
│  │ Storage             │     │  │ + RLS    │ (Deno)  │          │          │
│  └─────────────────────┘     │  └──────────┴──────────┴──────────┴───────────┘
│  Cloudflare (DNS + DDoS)     │                    │
└──────────────────────────────┘          ┌─────────┴─────────┐
                                          ▼                   ▼
                                ┌──────────────────┐  ┌──────────────────┐
                                │  AI APIs         │  │  Email/Scraping  │
                                │  ├── Lovable AI  │  │  ├── Resend      │
                                │  └── OpenAI      │  │  └── Firecrawl   │
                                └──────────────────┘  └──────────────────┘
```

### Princípios de Design

| Princípio | Implementação |
|-----------|---------------|
| **Separation of Concerns** | UI em React, lógica em Edge Functions, dados em PostgreSQL |
| **Mobile-First** | Tailwind breakpoints, carousel mobile, touch-friendly |
| **Security by Default** | RLS em todas tabelas, Edge Functions para ops anônimas |
| **Performance** | React Query cache, lazy loading, Service Worker, CDN |
| **Resilience** | CDN fallback (3 camadas), Error Boundaries, retry automático |
| **Cost Efficiency** | Cron otimizado (6h), logs locais, select específico |
| **Maintainability** | TypeScript strict, ESLint, barrel exports, logger centralizado |

---

## Diagrama de Componentes

### Frontend (React)

```
src/
├── pages/                     # Rotas (todas lazy loaded)
│   ├── Index.tsx             # Homepage
│   ├── Eventos.tsx           # Lista de eventos (useEvents hook)
│   ├── Blog.tsx              # Lista de posts (React Query inline)
│   ├── Podcast.tsx           # MDAccula Radio (rota: /MDAcculaRadio)
│   ├── Links.tsx             # Página de links (useLinks hook)
│   ├── Redirect.tsx          # Redirecionador /r/:slug
│   ├── Search.tsx            # Busca full-text
│   ├── Privacidade.tsx       # Política de privacidade
│   └── admin/                # 15 páginas administrativas
│       ├── EventsManager.tsx
│       ├── BlogManager.tsx
│       ├── LinksManager.tsx
│       ├── PodcastManager.tsx
│       ├── RedirectsManager.tsx
│       ├── DataImport.tsx
│       ├── Settings.tsx
│       ├── SystemHealth.tsx
│       ├── AutoGenerationDashboard.tsx
│       └── ...
│
├── components/
│   ├── ui/                   # ~50 componentes Shadcn/UI
│   │   ├── ImageUploadWithCrop.tsx  # Upload + crop + WebP
│   │   └── RichTextEditor.tsx       # TipTap editor
│   ├── sections/             # Hero, FeaturedEvents, LatestNews, SectionHeading, CuradoriaCta
│   ├── events/                # EventForm, EventModal, EventsCarousel, EventCountdown
│   ├── effects/               # AuroraBackground, SpotlightCard (Framer Motion, reutilizáveis)
│   ├── blog/                 # BlogForm, LikeButton
│   ├── links/                # LinkCard, SortableItem, StaticIcon, DndWrapper
│   ├── OptimizedImage.tsx    # CDN fallback inteligente
│   ├── SEOHead.tsx           # Meta tags dinâmicas
│   ├── ShareButtons.tsx      # Share social (linha de ícones inline, cor de marca) — compartilhado entre evento e blog
│   └── NewsletterPopup.tsx   # A/B testing popup
│
├── hooks/
│   ├── useAuth.tsx           # Context: user, session, profile, isAdmin
│   ├── useEvents.ts          # React Query: lista de eventos
│   ├── useLinks.ts           # React Query: links + grupos
│   ├── useSiteSettings.tsx   # Re-export do SiteSettingsContext
│   ├── useDebouncedValue.ts  # Debounce genérico
│   ├── useTiltParallax.ts    # Tilt 3D (useTiltRotate) + parallax de mural (useMuralParallax), Framer Motion
│   ├── useMagneticHover.ts   # Botão que "puxa" na direção do cursor (Framer Motion)
│   └── useToast.ts           # Notificações toast
│
├── contexts/
│   └── SiteSettingsContext.tsx  # Provider global (cache localStorage)
│
├── lib/
│   ├── utils.ts              # cn(), parseLocalDate()
│   ├── imageUtils.ts         # getOptimizedImageUrl(), getOriginalSupabaseUrl()
│   ├── eventDateHelper.ts    # isEventVisible(), filterVisibleEvents()
│   ├── linkThemes.ts         # 13+ temas (neonPurple, etc)
│   ├── linkSortHelper.ts     # sortByEventDate()
│   ├── brandColors.ts        # getBrandColor() — cor real por plataforma (Instagram, WhatsApp, etc), só no ícone
│   ├── webpConverter.ts      # convertToWebP() client-side
│   └── logger.ts             # Logger com níveis e scoped logging
│
└── types/
    └── index.ts              # Event, RawLinkData, PodcastSubmission, etc
```

### Backend (Edge Functions)

> Lista completa das 51 functions (`supabase/functions/*/`) atualizada em 17/07/2026.
> Deploy automático via GitHub Actions a cada push em `main` — ver seção
> [Deploy de Edge Functions](#deploy-de-edge-functions) logo abaixo.

```
supabase/functions/
├── _shared/                        # Módulos compartilhados (importados via "../_shared/x.ts")
│   ├── index.ts                    # CORS, jsonSuccess/jsonError, fetchWithTimeout, rate limit,
│   │                                # scrapeWithFirecrawl, authorizeAdminOrCron
│   ├── emailBlocks.ts              # Renderer canônico dos blocos de e-mail (HTML + texto)
│   ├── emailComposer.ts            # composeEmail(), buildEventAnnouncementData(), validação
│   ├── emailMeta.ts                # Placeholders de assunto/preheader ({{event_title}} etc.)
│   ├── emailBlocksLimits.ts        # Limites/defaults numéricos dos blocos de e-mail
│   ├── eventCta.ts                 # Fonte única do tipo de botão/CTA do evento (cta_type)
│   ├── egoiClient.ts               # Cliente HTTP da API v3 da E-goi (egoiRequest)
│   ├── titleSanitizer.ts           # Sanitização/validação de títulos de artigos
│   ├── editorialQuality.ts         # Bloco de regras editoriais injetado nos prompts de IA
│   └── scrapeGate.ts               # Decide se roda scraping de contexto antes de gerar artigo
│
├── Geração de conteúdo IA/
│   ├── generate-blog-suggestions/  # Scrape de fontes + gera sugestões de pauta
│   ├── generate-blog-post-v2/      # Gera artigo de evento + imagem (dual routing OpenAI/Gemini)
│   ├── generate-blog-post-from-topic/ # Artigo editorial a partir de busca real (Firecrawl /search)
│   ├── generate-multi-event-article/  # Artigo consolidado multi-datas (festival/série)
│   ├── regenerate-blog-image/      # Regenera só a imagem de um post existente
│   ├── compose-event-image/        # Aplica marca MDAccula sobre uma imagem já hospedada
│   └── auto-article-cron/          # Cron job de geração automática (sem JWT)
│
├── Event Watcher (Fase B)/
│   ├── scan-event-sources/         # Raspa fontes (site/Instagram) e cria rascunhos de evento
│   └── apify-instagram-webhook/    # Recebe posts novos do monitor Apify do Instagram
│
├── Automação de eventos/
│   ├── create-recurring-events/    # Eventos semanais recorrentes (cron)
│   ├── geocode-event/              # Geocodifica venue → latitude/longitude
│   ├── render-static-map/          # Gera imagem estática do mapa (usada no e-mail)
│   └── public-maps-config/         # Chave pública do Google Maps (domínio próprio)
│
├── Email (E-goi)/
│   ├── create-event-email-campaign/    # Cria/reaproveita rascunho de campanha por evento
│   ├── send-scheduled-email-campaigns/ # Poller (5 min) que dispara envios agendados
│   ├── weekend-agenda-draft/       # Rascunho da Agenda do FDS
│   ├── weekly-digest-draft/        # Rascunho do Resumo Semanal
│   ├── blog-digest-draft/          # Rascunho de novidades do blog
│   ├── update-digest-schedule/     # Atualiza o pg_cron dos digests
│   ├── egoi-resources/             # Lista listas/remetentes da conta E-goi
│   ├── egoi-campaign-stats/        # Estatísticas de campanha (abertura/clique)
│   ├── egoi-curl-probe/            # Diagnóstico bruto de conectividade com a E-goi
│   └── send-test-email/            # Envia HTML de teste pro e-mail admin fixo (via Resend)
│
├── Email (outros)/
│   ├── send-contact-email/         # Formulário de contato
│   ├── send-mass-newsletter/       # Newsletter em batch
│   └── send-podcast-notification/  # Email artista + agência (inscrição no podcast)
│
├── Tracking/
│   ├── track-link-click/           # Clique em link (Links page)
│   ├── track-redirect-click/       # Clique em redirect UTM
│   ├── track-view/                 # View de post/evento
│   ├── track-share/                # Compartilhamento
│   └── track-egress/               # Amostragem de egress por rota (custos)
│
├── Observabilidade/
│   ├── systemhealth/               # Health check
│   ├── persist-logs/               # Persistência de logs
│   ├── metrics-snapshot/           # Snapshot diário de métricas (Bunny + Supabase)
│   ├── bunny-stats/                # Estatísticas de uso do Bunny CDN
│   ├── supabase-usage/             # Uso/quota do projeto Supabase
│   └── egress-alert-cron/          # Alerta por e-mail se egress disparar
│
├── Mídia/
│   ├── convert-to-webp/            # Conversão individual
│   ├── batch-convert-webp/         # Conversão em lote
│   ├── upload-to-bunny/            # Upload direto pro Bunny Storage
│   ├── migrate-to-bunny/           # Migração em lote pro Bunny
│   └── diagnose-media/             # Diagnóstico de imagens quebradas/órfãs
│
├── Dados/
│   ├── import-csv-data/            # Processa CSV importado
│   ├── upload-csv/                 # Upload de CSV
│   ├── import-storage/             # Importa arquivos de Storage
│   └── cleanup-storage/            # Remove imagens órfãs
│
└── Utilitários/
    ├── sitemap/                    # Sitemap XML dinâmico
    ├── blog-rss/                   # Feed RSS
    ├── fetch-link-metadata/        # Metadados de URL (Links page)
    ├── indexnow-notify/            # Notifica IndexNow (Bing/Yandex) em mudanças
    ├── cleanup-sync-logs/          # Limpa logs antigos de sincronização
    └── request-data-deletion/      # LGPD: exclusão de dados
```

### Deploy de Edge Functions

Desde 17/07/2026, o deploy é automático: `.github/workflows/deploy-edge-functions.yml` roda
`supabase functions deploy` (CLI oficial da Supabase) a cada push em `main` que toque
`supabase/functions/**`, usando o secret `SUPABASE_ACCESS_TOKEN`. O CLI oficial empacota
`_shared/` corretamente em qualquer função que a importe — **não usar** o deployer visual do
Lovable nem a tool `mcp__supabase-mdaccula__deploy_edge_function` como caminho normal de deploy;
ambos têm bugs conhecidos de empacotamento (ver comentário "DEPLOY NOTE" no topo de
`scan-event-sources/index.ts` para o caso mais grave — funções com `EdgeRuntime.waitUntil()` real
+ deploy multi-arquivo por essas duas vias quebram com `BOOT_ERROR`; o CLI oficial não tem esse
problema).

`supabase/config.toml` define `verify_jwt = false` por função — **quase todas** precisam disso,
porque fazem sua própria autenticação (header `Authorization` + `has_role`, ou `x-cron-secret`
para cron/webhook) em vez de depender do gate de JWT da plataforma. Ao criar uma função nova que
não deva exigir um usuário logado do Supabase Auth, adicionar a entrada correspondente em
`config.toml` — sem isso, o próximo deploy via CLI reverte pro padrão (`verify_jwt = true`) e
quebra cron jobs/webhooks/chamadas públicas silenciosamente.

---

## Fluxos de Dados

### 1. Fluxo de Autenticação

```
┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  User   │───▶│ Auth Page   │───▶│ Supabase Auth│───▶│ user_roles  │
│         │    │ (signIn/Up) │    │ (JWT token)  │    │ (check role)│
└─────────┘    └─────────────┘    └──────────────┘    └─────────────┘
                                          │
                                          ▼
                                  ┌──────────────┐
                                  │  AuthContext  │
                                  │  {isAdmin}    │
                                  └──────────────┘
```

### 2. Fluxo de Geração de Artigo IA

```
┌─────────────┐    ┌────────────────────┐    ┌─────────────────┐
│ Admin UI    │───▶│ generate-blog-     │───▶│ Firecrawl       │
│ (trigger)   │    │ suggestions        │    │ (scrape 2 news) │
└─────────────┘    └────────────────────┘    └─────────────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │ Routing Decision   │
                   │ (ai_blog_model)    │
                   ├────────┬───────────┤
                   │ OpenAI │ Lovable AI│
                   │ direto │ Gateway   │
                   │(GPT-5m)│(Gemini2.5)│
                   └────────┴───────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │ Post-processing    │
                   │ - removeFakeLinks()│
                   │ - sanitize HTML    │
                   └────────────────────┘
                            │
                            ▼
                   ┌────────────────────┐    ┌─────────────────┐
                   │ Supabase Storage   │◀───│ Image Generation│
                   │ (save WebP image)  │    │ (Nano Banana)   │
                   └────────────────────┘    └─────────────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │ blog_posts +       │
                   │ ai_generated_posts │
                   └────────────────────┘
```

### 3. Fluxo de Inscrição Podcast

```
┌─────────────────┐    ┌────────────────────┐    ┌─────────────────┐
│ Formulário      │───▶│ Zod Validation     │───▶│ podcast_        │
│ /MDAcculaRadio  │    │ (13+ campos)       │    │ submissions     │
└─────────────────┘    └────────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │ send-podcast-   │
                                             │ notification    │
                                             └─────────────────┘
                                                      │
                                     ┌────────────────┴────────────────┐
                                     ▼                                 ▼
                            ┌─────────────────┐              ┌─────────────────┐
                            │ Email Artista   │              │ Email Agência   │
                            │ (confirmação)   │              │ (lead details)  │
                            └─────────────────┘              └─────────────────┘
```

### 4. Fluxo de Eventos Recorrentes

```
┌─────────────┐    ┌────────────────────┐    ┌─────────────────┐
│ pg_cron     │───▶│ create-recurring-  │───▶│ recurring_event_│
│ (terça 03h) │    │ events             │    │ configs         │
└─────────────┘    └────────────────────┘    └─────────────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │ Para cada config:  │
                   │ 1. Calcular data   │
                   │ 2. Checar duplicata│
                   │ 3. Insert evento   │
                   └────────────────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │ events table       │
                   │ (insert if new)    │
                   └────────────────────┘
```

### 5. Fluxo de Redirect com UTM

```
┌─────────┐    ┌─────────────┐    ┌────────────────────┐    ┌──────────────┐
│ Usuário │───▶│ /r/:slug    │───▶│ Busca redirect_    │───▶│ Monta URL    │
│ clica   │    │ (Redirect)  │    │ links por slug     │    │ destino+UTM  │
└─────────┘    └─────────────┘    └────────────────────┘    └──────────────┘
                                                                   │
                                          ┌────────────────────────┘
                                          ▼
                                 ┌─────────────────┐    ┌─────────────────┐
                                 │ track-redirect-  │───▶│ redirect_click_ │
                                 │ click (async)    │    │ events          │
                                 └─────────────────┘    └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ window.location  │
                                 │ = destination_url│
                                 └─────────────────┘
```

### 6. Fluxo de Imagem com CDN Fallback

```
┌──────────────────┐
│ OptimizedImage   │
│ ou EventCard     │
└────────┬─────────┘
         │ getOptimizedImageUrl(supabase_url)
         ▼
┌──────────────────┐
│ cdn.mdaccula.com │ ── sucesso ──▶ Exibe imagem
│ (Bunny CDN)      │
└────────┬─────────┘
         │ onError
         ▼
┌──────────────────┐
│ getOriginal      │
│ SupabaseUrl()    │ ── sucesso ──▶ Exibe imagem
│ (Supabase direto)│
└────────┬─────────┘
         │ onError
         ▼
┌──────────────────┐
│ Placeholder      │
│ (dj-performance  │
│  ou gradiente)   │
└──────────────────┘
```

---

## APIs e Endpoints

### Edge Functions - Request/Response

#### `POST /functions/v1/send-podcast-notification`

```typescript
// Request
{ id, full_name, city, phone, project_name, project_age, genre,
  has_original_track, original_track_link?, instagram?, spotify?,
  soundcloud?, tiktok?, email, project_description }

// Response
{ success: boolean, results: {
    artistEmail: { success, error? },
    agencyEmail: { success, error? },
    dbUpdate: { success, error? }
}}
```

#### `POST /functions/v1/generate-blog-suggestions`

```typescript
// Request: no body (uses news_sources + ai_blog_model from DB)

// Response
{ success: boolean, suggestions: Array<{
    title, excerpt, keywords: string[], category, sourceUrl?
  }>, tokensUsed: number }
```

#### `POST /functions/v1/track-link-click`

```typescript
// Request
{ linkId: string }

// Response
{ success: boolean, newClickCount: number }
```

#### `POST /functions/v1/track-redirect-click`

```typescript
// Request
{ slug: string }

// Response
{ success: boolean }
```

#### `POST /functions/v1/import-csv-data`

```typescript
// Request
{ table: string, data: Record<string, unknown>[] }

// Response
{ success: boolean, imported: number, errors?: string[] }
```

---

## Banco de Dados

### Schema Principal (ver [tabelas.md](/tabelas.md) para SQL completo)

**25 tabelas** organizadas em:
- **Conteúdo:** events, blog_posts, custom_links, link_groups, redirect_links
- **IA:** ai_prompt_templates, ai_generated_posts, news_sources
- **Usuários:** profiles, user_roles
- **Analytics:** blog_view_events, event_view_events, link_click_events, redirect_click_events, share_analytics, newsletter_popup_analytics
- **Newsletter:** newsletter_subscribers, newsletter_popup_variants
- **Automação:** recurring_event_configs, event_templates, sync_logs
- **Sistema:** site_settings, application_logs, performance_metrics
- **Leads:** podcast_submissions, team_members

### Índices de Performance

```sql
CREATE INDEX idx_events_date_location ON events(date, location_state, location_city);
CREATE INDEX idx_blog_status_date ON blog_posts(published, published_at DESC);
CREATE INDEX idx_links_group_order ON custom_links(group_id, display_order);
CREATE INDEX idx_podcast_status ON podcast_submissions(status, created_at DESC);
CREATE INDEX idx_blog_search ON blog_posts USING GIN(search_vector);
```

### RLS Pattern

```sql
-- Padrão público (leitura anônima, escrita admin)
CREATE POLICY "Public read" ON events FOR SELECT USING (true);
CREATE POLICY "Admin write" ON events FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Padrão tracking (insert anônimo via Edge Function com service_role)
CREATE POLICY "Service insert" ON link_click_events FOR INSERT WITH CHECK (true);
```

---

## CDN e Imagens

### Arquitetura

| Componente | Função |
|------------|--------|
| **Supabase Storage** | Origin: armazena imagens originais (event-images, link-thumbnails, team-images) |
| **Bunny CDN** | Pull Zone com origin no Supabase Storage. Cache de borda global |
| **Cloudflare** | DNS de cdn.mdaccula.com + proteção DDoS |

### `src/lib/imageUtils.ts`

| Função | Input | Output |
|--------|-------|--------|
| `getOptimizedImageUrl(url)` | URL Supabase Storage | URL CDN (cdn.mdaccula.com) |
| `getOriginalSupabaseUrl(url)` | URL CDN | URL Supabase original |

### Conversão WebP

| Contexto | Método |
|----------|--------|
| Upload no admin | `webpConverter.ts` client-side (browser Canvas API) |
| Imagem existente | Edge Function `convert-to-webp` |
| Migração em lote | Edge Function `batch-convert-webp` |

---

## Autenticação e Autorização

### Roles

| Role | Permissões |
|------|------------|
| `admin` | CRUD completo em todas as tabelas |
| `moderator` | CRUD em eventos e blog_posts |
| `user` | Leitura pública apenas |

### Verificação

```typescript
// Frontend (React Context)
const { isAdmin } = useAuth();

// SQL (RLS Policy) - usa SECURITY DEFINER para evitar recursão
EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')

// Atalho SQL
SELECT is_admin(); -- retorna boolean
```

**⚠️ CRÍTICO:** Admin status NUNCA é verificado via localStorage ou hardcoded. Sempre via `user_roles` no banco.

---

## Integrações Externas

### Lovable AI Gateway (Gemini)

```typescript
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [...], temperature: 0.9, max_tokens: 4000,
  }),
});
```

### OpenAI (direto)

```typescript
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
  body: JSON.stringify({
    model: "gpt-4.1-mini", // ou gpt-5-mini
    messages: [...], temperature: 0.7,
  }),
});
```

### Resend (Email)

```typescript
import { Resend } from "npm:resend@2.0.0";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
await resend.emails.send({
  from: "MDAccula <no-reply@mdaccula.com>",
  to: email, subject: "...", html: htmlTemplate,
});
```

---

## Cache e Performance

### React Query

```typescript
const queryClient = new QueryClient({
  defaultOptions: { queries: {
    staleTime: 5 * 60 * 1000,    // 5 minutos
    retry: 1,
    refetchOnWindowFocus: false,
  }},
});
```

### Service Worker (v5)

| Recurso | Estratégia | Cache |
|---------|-----------|-------|
| HTML | Network-First | Fallback offline |
| JS/CSS/Fontes | Cache-First | 30 dias |
| Imagens | Stale-While-Revalidate | Background update |
| API /links | Stale-While-Revalidate | Background update |

### SiteSettings

Provider global com cache em localStorage. Carrega uma vez, revalida em background a cada 15 min.

### Otimizações de Bundle

- Todas as páginas: `React.lazy()` + `Suspense`
- DnD Kit: lazy import apenas para admins
- StaticIcon: mapa estático vs import dinâmico por ícone
- VirtualizedLinkList: virtualização para >20 links
- LightningCSS: minificação de CSS
- Terser: minificação de JS com múltiplos passes
- `manualChunks` (`vite.config.ts`) agrupa só dependências genuinamente globais (react-vendor,
  query, supabase, ui-vendor/ui-forms — usadas pelos providers raiz do `App.tsx`). **`icons`
  (lucide-react) e `charts` (recharts) não são mais agrupados manualmente** (16/07/2026): como
  `ErrorBoundary`/`Toast` (montados eager na raiz) importavam alguns ícones, o agrupamento forçava
  o Rollup a tratar o pacote INTEIRO de ícones — usado em qualquer página, inclusive admin — como
  dependência estática de toda rota, resultando em ~991KB sempre pré-carregados via
  `<link rel="modulepreload">` no `index.html`, mesmo em páginas que não usam nada disso. Sem esse
  agrupamento, o Rollup faz chunking automático por uso real (cada ícone/gráfico vira um chunk
  minúsculo carregado só pela página que o importa).

---

## Segurança

> Detalhes completos em [SECURITY-AUDIT.md](/docs/SECURITY-AUDIT.md)

### Checklist

- [x] RLS em todas as 25 tabelas
- [x] Edge Functions para operações anônimas (bypass RLS seguro)
- [x] Validação Zod no frontend
- [x] Rate limiting em Edge Functions + DB triggers
- [x] CORS configurado
- [x] Secrets em variáveis de ambiente (nunca no código)
- [x] Sanitização HTML (escapeHtml em emails)
- [x] Roles em tabela separada (NUNCA em profiles/localStorage)
- [x] `has_role()` com SECURITY DEFINER
- [ ] CAPTCHA no formulário de contato
- [ ] Leaked Password Protection

---

## Documentos Relacionados

| Documento | Descrição |
|-----------|-----------|
| [README.md](/README.md) | Documentação principal |
| [PRD.md](/docs/PRD.md) | Requisitos do produto |
| [ROADMAP.md](/docs/ROADMAP.md) | Cronograma de desenvolvimento |
| [CODE_STYLE.md](/docs/CODE_STYLE.md) | Guia de estilo |
| [SECURITY-AUDIT.md](/docs/SECURITY-AUDIT.md) | Auditoria de segurança |
| [tabelas.md](/tabelas.md) | Schema SQL completo |
| [CHANGELOG.md](/CHANGELOG.md) | Histórico do que já foi entregue |
| [PENDENCIAS.MD](/PENDENCIAS.MD) | Itens em aberto (decisões, bugs, monitoramento) |

---

*Última atualização: 16/07/2026*
