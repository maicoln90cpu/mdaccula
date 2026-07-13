# MDAccula - Electronic Music Agency Platform

> Sistema completo para agência de música eletrônica com gestão de eventos, blog com IA, links personalizáveis, eventos recorrentes automatizados, programa de podcast, redirecionador de links com UTM e analytics.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Status](https://img.shields.io/badge/Status-Fase%203%20Expansão-blue)

**URL do Projeto:** https://lovable.dev/projects/5fbf20d7-2f06-4b9e-8486-f99fd516e773  
**Domínio:** https://mdaccula.com  
**CDN:** https://cdn.mdaccula.com (Bunny CDN → Supabase Storage)  
**Versão:** 1.4.0 | **Última atualização:** 13/07/2026

> **Novidades 07/2026:** renderer de e-mails unificado (fonte única frontend↔edge com snapshot bilateral), slim-down de `EmailConfig`/`EventForm`/`LinksManager`, AbortController em telas com busca, roteamento de template por automação, e Google Maps funcionando em `mdaccula.com` via edge `public-maps-config` + chave própria com referrer allowlist e **Maps Embed API** ativa.

---

## 📚 Documentação Completa

| Documento | Descrição |
|-----------|-----------|
| [📋 PRD.md](docs/PRD.md) | Requisitos do produto, objetivos e backlog |
| [🗺️ ROADMAP.md](docs/ROADMAP.md) | Fases de desenvolvimento e cronograma |
| [📝 PENDENCIAS.MD](PENDENCIAS.MD) | Tarefas pendentes e histórico de mudanças |
| [🎨 CODE_STYLE.md](docs/CODE_STYLE.md) | Guia de estilo e convenções de código |
| [🔒 SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) | Auditoria de segurança e políticas RLS |
| [🏗️ SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) | Arquitetura técnica e fluxos de dados |
| [🗃️ tabelas.md](tabelas.md) | Documentação SQL do banco de dados |
| [🧪 TESTING.md](docs/TESTING.md) | Como rodar testes, coverage ratchet e catálogo de regressões |

---

## 🚀 Deploy na Hostinger (Node.js)

O projeto inclui um servidor Express mínimo (`server.js`) que serve a build estática (`dist/`) e implementa **SPA fallback** — qualquer rota desconhecida devolve `index.html`, permitindo que links diretos como `/eventos`, `/blog/post-x` ou `/links` funcionem ao serem colados no navegador ou ao dar F5.

**Configuração no hPanel:**
- **Arquivo de entrada:** `server.js`
- **Build command:** `npm install && npm run build`
- **Start command:** `npm start` (executa `node server.js`)
- **Porta:** lida de `process.env.PORT` (padrão 3000)

**Healthcheck:** `GET /healthz` → `{ ok: true }`

⚠️ Não remova `server.js` nem o script `start` do `package.json` — sem eles, links diretos voltam a dar 404 em produção.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Arquitetura do Projeto](#arquitetura-do-projeto)
4. [Estrutura de Pastas](#estrutura-de-pastas)
5. [Banco de Dados](#banco-de-dados)
6. [Edge Functions](#edge-functions)
7. [Sistema de Autenticação](#sistema-de-autenticação)
8. [CDN e Imagens](#cdn-e-imagens)
9. [Design System](#design-system)
10. [Funcionalidades Principais](#funcionalidades-principais)
11. [Configurações e Secrets](#configurações-e-secrets)
12. [Padrões de Código](#padrões-de-código)
13. [Regras de Negócio Importantes](#regras-de-negócio-importantes)
14. [Setup e Desenvolvimento](#setup-e-desenvolvimento)
15. [Deploy e Cache](#deploy-e-cache)
16. [Troubleshooting](#troubleshooting)

---

## Visão Geral

**MDAccula** é uma plataforma web completa para uma agência de música eletrônica brasileira. O sistema oferece:

- **Website público** com eventos, blog e página de contato
- **Painel administrativo** completo para gestão de conteúdo
- **Sistema de IA** para geração automática de artigos com prompts avançados
- **Eventos recorrentes** automatizados (D.EDGE: Moving, FreakChic, Nave, SuperAfter)
- **Programa de Podcast** com inscrições de DJs e gerenciamento de leads
- **Página de links** personalizável (estilo Linktree)
- **Redirecionador de links** com UTM tracking (mdaccula.com/r/:slug)
- **CDN com fallback inteligente** (Bunny CDN → Supabase → placeholder)
- **Analytics** de visualizações, cliques e engajamento
- **Newsletter** com testes A/B
- **Importação de dados** via CSV

### URLs Principais

| Rota | Descrição |
|------|-----------|
| `/` | Homepage com hero, eventos em destaque e últimas notícias |
| `/eventos` | Lista de todos os eventos com filtros + carousel mobile |
| `/eventos/:slug` | Página de detalhe do evento |
| `/blog` | Lista de artigos do blog |
| `/blog/:slug` | Artigo individual |
| `/MDAcculaRadio` | Página do programa MDAccula Radio com formulário de inscrição |
| `/links` | Página de links personalizável |
| `/links/:slug` | Grupo de links específico |
| `/quem-somos` | Página institucional com equipe |
| `/contato` | Formulário de contato |
| `/busca` | Busca full-text no blog |
| `/privacidade` | Política de privacidade |
| `/r/:slug` | Redirecionador de links curtos com UTM tracking |
| `/admin/*` | Painel administrativo (requer autenticação) |
| `/admin/recurring-events` | Gerenciador de eventos recorrentes |
| `/admin/mdaccula-radio` | Gerenciador de inscrições do MDAccula Radio |
| `/admin/redirects` | Gerenciador de links de redirecionamento |
| `/admin/data-import` | Importação de dados via CSV |

---

## Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | ^18.3 | Framework principal |
| TypeScript | ^5.8 | Tipagem estática |
| Vite | ^5.4 | Build tool com LightningCSS |
| Tailwind CSS | ^3.4 | Estilização |
| React Router DOM | ^6.30 | Roteamento com lazy loading |
| TanStack Query | ^5.83 | Gerenciamento de estado servidor |
| TanStack Virtual | ^3.13 | Virtualização de listas longas |
| React Hook Form | ^7.61 | Formulários |
| Zod | ^3.25 | Validação de schemas |
| Recharts | ^2.15 | Gráficos |
| Shadcn/UI | - | Componentes UI |
| Embla Carousel | ^8.6 | Carousel mobile |
| TipTap | ^3.10 | Editor rich text |
| DnD Kit | ^6.3 | Drag & drop (lazy loaded) |

### Backend (Lovable Cloud / Supabase)
| Componente | Descrição |
|------------|-----------|
| PostgreSQL | Banco de dados relacional (25 tabelas) |
| Edge Functions (Deno) | 20+ funções serverless |
| Row Level Security (RLS) | Segurança a nível de linha em todas as tabelas |
| Storage | Armazenamento de imagens (event-images, team-images, link-thumbnails) |
| pg_cron | Jobs agendados (eventos recorrentes, limpeza) |

### CDN e Infraestrutura
| Serviço | Uso |
|---------|-----|
| Bunny CDN | Cache de imagens (cdn.mdaccula.com) |
| Cloudflare | DNS + proteção DDoS |

### Integrações Externas
| Serviço | Uso |
|---------|-----|
| OpenAI API | Geração de artigos (GPT-4.1 mini, GPT-5 mini) |
| Lovable AI | Geração de artigos (Gemini 2.5 Flash) |
| Firecrawl | Scraping de notícias para IA |
| Resend | Envio de emails (newsletter, contato, podcast) |
| Google Tag Manager | Analytics |
| Hotjar | Heatmaps e gravações |

---

## Arquitetura do Projeto

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React SPA)                     │
├─────────────────────────────────────────────────────────────────┤
│  Pages (lazy)    │  Components       │  Hooks & Context          │
│  ├── Index       │  ├── ui/          │  ├── useAuth (Context)   │
│  ├── Eventos     │  ├── sections/    │  ├── useSiteSettings     │
│  ├── Blog        │  ├── admin/       │  ├── useEvents (RQ)      │
│  ├── Links       │  ├── events/      │  ├── useLinks (RQ)       │
│  ├── Podcast     │  ├── blog/        │  └── useDebouncedValue   │
│  ├── Redirect    │  └── links/       │                           │
│  └── Admin/*     │                   │                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────┐
│   BUNNY CDN (Imagens)    │  │  SUPABASE (Lovable)  │
│   cdn.mdaccula.com       │  │  ├── PostgreSQL (25t) │
│   ├── Cache de borda     │  │  ├── Edge Functions   │
│   └── Origin: Supabase   │  │  ├── Storage          │
│                          │  │  └── Auth + RLS       │
└──────────────────────────┘  └──────────────────────┘
                                        │
                              ┌─────────┴─────────┐
                              ▼                   ▼
                    ┌──────────────────┐  ┌──────────────────┐
                    │  Lovable AI /    │  │  Resend (Email)  │
                    │  OpenAI / Fire-  │  │  Firecrawl       │
                    │  crawl           │  │                  │
                    └──────────────────┘  └──────────────────┘
```

---

## Estrutura de Pastas

```
├── src/
│   ├── assets/              # Imagens estáticas
│   ├── components/
│   │   ├── ui/              # Componentes Shadcn/UI (~50 componentes)
│   │   │   ├── badge.tsx    # Badge com variantes (success, warning, priority-*)
│   │   │   ├── button.tsx   # Botão padrão
│   │   │   ├── card.tsx     # Card com variantes (metric, alert, success, etc)
│   │   │   ├── table.tsx    # Tabela com variantes (striped, bordered, compact)
│   │   │   ├── ImageUploadWithCrop.tsx  # Upload com crop e conversão WebP
│   │   │   ├── RichTextEditor.tsx       # Editor TipTap
│   │   │   └── SearchBar.tsx            # Busca com debounce
│   │   ├── admin/           # Componentes exclusivos do admin
│   │   │   ├── AIAnalyticsDashboard.tsx
│   │   │   ├── MultiEventArticleModal.tsx
│   │   │   ├── TechDebtDashboard.tsx
│   │   │   └── VirtualizedLinkList.tsx  # Lista virtualizada (>20 itens)
│   │   ├── blog/            # BlogForm, LikeButton
│   │   ├── events/          # EventForm, EventModal, EventsCarousel
│   │   ├── links/           # LinkCard, SortableItem, ThemeSelector, StaticIcon
│   │   ├── sections/        # Hero, FeaturedEvents, LatestNews
│   │   ├── OptimizedImage.tsx  # Imagem com CDN fallback inteligente
│   │   ├── SEOHead.tsx         # Meta tags por página
│   │   ├── ShareButtons.tsx    # Compartilhamento social
│   │   └── NewsletterPopup.tsx # Popup A/B testing
│   ├── hooks/
│   │   ├── index.ts         # Barrel export
│   │   ├── useAuth.tsx      # Autenticação e contexto de usuário
│   │   ├── useEvents.ts     # React Query para eventos
│   │   ├── useLinks.ts      # React Query para links
│   │   ├── useSiteSettings.tsx # Configurações do site (via Context)
│   │   ├── useDebouncedValue.ts # Debounce genérico
│   │   └── useToast.ts      # Sistema de notificações
│   ├── contexts/
│   │   └── SiteSettingsContext.tsx  # Provider global com cache localStorage
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts    # Cliente Supabase (NÃO EDITAR)
│   │       └── types.ts     # Tipos do banco (NÃO EDITAR - auto-gerado)
│   ├── lib/
│   │   ├── index.ts         # Barrel export
│   │   ├── utils.ts         # cn(), parseLocalDate()
│   │   ├── eventDateHelper.ts # Visibilidade de eventos por timezone
│   │   ├── imageUtils.ts    # CDN URL rewriting + fallback Supabase
│   │   ├── linkThemes.ts    # 13+ temas para página de links
│   │   ├── linkSortHelper.ts # Ordenação de links por data de evento
│   │   ├── eventGroupHelper.ts # Nome de grupo de links
│   │   ├── webpConverter.ts # Conversão client-side para WebP
│   │   └── logger.ts        # Logger centralizado (debug/info/warn/error)
│   ├── types/
│   │   └── index.ts         # Tipos compartilhados (Event, RawLinkData, etc)
│   ├── pages/
│   │   ├── admin/           # 15 páginas administrativas
│   │   └── *.tsx            # 13 páginas públicas
│   ├── App.tsx              # Roteamento principal (lazy loading)
│   ├── index.css            # Design System CSS completo
│   └── main.tsx             # Entry point com ErrorBoundary global
├── supabase/
│   ├── config.toml          # Configuração Supabase (NÃO EDITAR)
│   └── functions/           # 20+ Edge Functions (Deno)
│       ├── _shared/         # Módulos compartilhados (cors, rate-limit, etc)
│       └── [function-name]/index.ts
├── public/
│   ├── service-worker.js    # PWA (Network-First, v5)
│   ├── robots.txt           # SEO
│   └── sitemap.xml          # Sitemap estático
├── docs/                    # Documentação técnica
├── tailwind.config.ts       # Tokens e animações Tailwind
└── tabelas.md               # SQL para recriar banco do zero
```

---

## Banco de Dados

### Tabelas (25 tabelas)

| Tabela | Descrição | RLS |
|--------|-----------|-----|
| `events` | Eventos da agência | ✅ Público leitura, Admin CRUD |
| `recurring_event_configs` | Configurações de eventos recorrentes | ✅ Admin apenas |
| `blog_posts` | Artigos do blog | ✅ Publicados = público, Admin CRUD |
| `blog_post_likes` | Likes em posts | ✅ Próprio usuário |
| `blog_view_events` | Log de views de posts | ✅ Insert público |
| `event_view_events` | Log de views de eventos | ✅ Insert público |
| `custom_links` | Links personalizáveis | ✅ Habilitados = público, Admin CRUD |
| `link_groups` | Grupos de links | ✅ Habilitados = público |
| `link_click_events` | Log de cliques em links | ✅ Insert via Edge Function |
| `redirect_links` | Links curtos com UTM | ✅ Admin CRUD |
| `redirect_click_events` | Log de cliques em redirects | ✅ Insert via Edge Function |
| `profiles` | Perfis de usuários | ✅ Próprio usuário apenas |
| `user_roles` | Roles (admin, moderator, user) | ✅ Próprio usuário leitura |
| `site_settings` | Configurações key-value | ✅ Público leitura, Admin CRUD |
| `team_members` | Membros da equipe | ✅ Ativos = público |
| `event_templates` | Templates de eventos | ✅ Admin apenas |
| `ai_prompt_templates` | Templates de prompts IA | ✅ Admin apenas |
| `ai_generated_posts` | Logs de geração IA (tokens, custo) | ✅ Admin apenas |
| `newsletter_subscribers` | Inscritos newsletter | ✅ Insert público (rate limited) |
| `newsletter_popup_variants` | Variantes A/B | ✅ Habilitados = público |
| `newsletter_popup_analytics` | Analytics popup | ✅ Insert público |
| `news_sources` | Fontes de notícias para IA | ✅ Admin apenas |
| `share_analytics` | Analytics de compartilhamentos | ✅ Insert via Edge Function |
| `sync_logs` | Logs de sincronização | ✅ Admin leitura |
| `podcast_submissions` | Inscrições do programa de podcast | ✅ Insert público, Admin CRUD |
| `application_logs` | Logs da aplicação | ✅ Insert via Edge Function |
| `performance_metrics` | Métricas de performance | ✅ Insert via Edge Function |

### Funções SQL Importantes

```sql
-- Verifica se usuário tem role específica (SECURITY DEFINER, evita recursão RLS)
has_role(_user_id uuid, _role app_role) → boolean

-- Atalhos para verificação
is_admin() → boolean
is_authenticated() → boolean

-- Incrementa views/clicks atomicamente
increment_post_views(post_id)
increment_event_views(event_id)
increment_link_clicks(link_id)
increment_redirect_clicks(redirect_slug)

-- Toggle de likes (retorna JSON com liked + total)
toggle_post_like(post_id) → {liked: boolean, total_likes: number}
user_liked_post(post_id) → boolean

-- Busca full-text no blog (português, com ranking)
search_blog_posts(search_query, category_filter?, limit?, offset?)

-- Utilitários
generate_slug(text_input) → text
validate_slug(input_slug) → boolean
is_valid_email(email) → boolean
cleanup_old_logs() → void
```

### Diagrama de Relacionamentos

```
events ──────────── event_templates (1:N para template base)
   │
   ├──────── blog_posts (1:1 via blog_post_id)
   └──────── custom_links (1:N via event_id)
   
custom_links ────── link_groups (N:1 via group_id)

redirect_links ──── redirect_click_events (1:N)

profiles ────────── auth.users (1:1 via id)
user_roles ──────── auth.users (N:1 via user_id)

recurring_event_configs ── link_groups (N:1 via link_group_id)
```

---

## Edge Functions

### Geração de Conteúdo IA

| Função | Descrição | Auth |
|--------|-----------|------|
| `generate-blog-suggestions` | Gera 5 sugestões baseado em news_sources (Firecrawl + IA) | JWT |
| `generate-blog-post-v2` | Gera artigo completo + imagem (Nano Banana) | JWT |
| `generate-multi-event-article` | Artigo consolidado de múltiplos eventos | JWT |
| `regenerate-blog-image` | Regenera imagem de artigo existente | JWT |
| `auto-article-cron` | Geração automática via pg_cron (sem JWT) | Service Key |

### Automação

| Função | Descrição | Auth |
|--------|-----------|------|
| `create-recurring-events` | Cria eventos semanais (D.EDGE) via pg_cron | Service Key |
| `cleanup-storage` | Remove imagens órfãs e duplicadas | JWT |
| `cleanup-sync-logs` | Limpa logs antigos de sincronização | JWT |

### Email

| Função | Descrição | Auth |
|--------|-----------|------|
| `send-contact-email` | Email do formulário de contato | Público (rate limited) |
| `send-mass-newsletter` | Newsletter em batch | JWT |
| `send-podcast-notification` | Confirmação artista + notificação agência | Público |

### Tracking (todas públicas, rate limited)

| Função | Descrição |
|--------|-----------|
| `track-link-click` | Clique em link (bypassa RLS) |
| `track-redirect-click` | Clique em redirect (incremento atômico) |
| `track-view` | Visualização de post/evento |
| `track-share` | Compartilhamento social |

### Utilitárias

| Função | Descrição | Auth |
|--------|-----------|------|
| `sitemap` | Sitemap XML dinâmico | Público |
| `blog-rss` | Feed RSS do blog | Público |
| `convert-to-webp` | Converte imagem para WebP | JWT |
| `batch-convert-webp` | Conversão em lote | JWT |
| `fetch-link-metadata` | Busca metadados de URLs | JWT |
| `import-csv-data` | Importação de dados via CSV | JWT |
| `upload-csv` | Upload de arquivo CSV | JWT |
| `systemhealth` | Verifica saúde do sistema | JWT |
| `persist-logs` | Persiste logs no banco (desativado por padrão) | JWT |
| `request-data-deletion` | Solicitação LGPD de exclusão | Público (rate limited) |

---

## Sistema de Autenticação

### Fluxo

```
1. Usuário acessa /login ou /auth
2. Sign up ou sign in via Supabase Auth
3. Email auto-confirmado (configuração Supabase)
4. Hook useAuth verifica user_roles
5. Se role = 'admin' → isAdmin = true
6. Rotas /admin/* verificam isAdmin via ProtectedRoute
```

### AuthContext

```typescript
interface AuthContextType {
  user: User | null;           // Usuário Supabase
  session: Session | null;     // Sessão ativa
  profile: Profile | null;     // Dados do perfil (full_name, phone)
  isAdmin: boolean;            // Verificado via user_roles (NUNCA localStorage)
  loading: boolean;            // Estado de carregamento
  signIn(email, password);     // Login
  signUp(email, password, fullName, phone?); // Registro
  signOut();                   // Logout
}
```

### Como Adicionar Admin

```sql
INSERT INTO user_roles (user_id, role) 
VALUES ('uuid-do-usuario', 'admin');
```

---

## CDN e Imagens

### Arquitetura de Imagens

```
Imagem salva no Supabase Storage (event-images, link-thumbnails)
         │
         ▼
getOptimizedImageUrl() reescreve URL:
  supabase.co/.../event-images/foto.webp → cdn.mdaccula.com/event-images/foto.webp
         │
         ▼
Bunny CDN serve da cache de borda (origin: Supabase Storage)
         │
    se falhar (cache corrompido, 403)
         │
         ▼
getOriginalSupabaseUrl() reverte para Supabase direto
         │
    se também falhar
         │
         ▼
Placeholder genérico (dj-performance.jpg ou gradiente CSS)
```

### Funções em `src/lib/imageUtils.ts`

| Função | Descrição |
|--------|-----------|
| `getOptimizedImageUrl(url)` | Supabase → CDN (reescrita de domínio) |
| `getOriginalSupabaseUrl(url)` | CDN → Supabase (fallback) |

### Conversão WebP

- **Client-side:** `src/lib/webpConverter.ts` converte no upload (ImageUploadWithCrop)
- **Server-side:** Edge Function `convert-to-webp` para conversão sob demanda
- **Batch:** Edge Function `batch-convert-webp` para migração de imagens existentes

---

## Design System

### Tokens de Cor (index.css)

```css
:root {
  --background: 220 25% 5%;      /* Fundo escuro */
  --foreground: 0 0% 95%;        /* Texto claro */
  --primary: 280 100% 50%;       /* Roxo neon */
  --secondary: 200 100% 38%;     /* Azul neon */
  --accent: 320 100% 65%;        /* Rosa neon */
  --muted: 220 25% 15%;
  --destructive: 0 84.2% 60.2%;
  --gradient-hero: linear-gradient(135deg, ...);
}
```

### Classes CSS Personalizadas

| Classe | Uso |
|--------|-----|
| `.prose` | Rich text/Markdown formatado |
| `.text-gradient` | Texto com gradiente neon |
| `.text-display` | Título display (4xl-6xl) |
| `.text-headline` | Título headline (2xl-3xl) |
| `.callout-*` | Blocos de destaque (info, warning, error, success) |
| `.divider-neon` | Separador com gradiente |
| `.table-enhanced` | Tabela estilizada |

### Variantes de Componentes

**Badge:** `default | secondary | destructive | outline | success | warning | info | priority-high | priority-medium | priority-low`

**Card:** `default | metric | alert | success | warning | info | featured | ghost`

**Table:** `default | striped | bordered | compact`

---

## Funcionalidades Principais

### 1. Gestão de Eventos
- CRUD completo com templates reutilizáveis
- Eventos recorrentes automatizados (D.EDGE) via pg_cron
- Integração com blog (artigo automático, multi-eventos)
- Filtros por cidade/estado/gênero com debounce
- Visibilidade baseada em timezone + grace hours
- Carousel mobile para próximos eventos (Embla Carousel)
- Sincronização de imagem evento → links vinculados

### 2. Blog com IA
- Geração de sugestões via scraping de news_sources (Firecrawl)
- Roteamento dual IA: OpenAI direto ou Gemini via Lovable AI Gateway
- Geração automática de imagens (Nano Banana, 6 variáveis de prompt)
- Agendamento automático via pg_cron (a cada 6h, configurável)
- Filtro de links fake no conteúdo gerado
- Analytics de tokens e custos por artigo
- Regeneração de imagens individuais
- Artigo multi-datas para séries de eventos
- Busca full-text com ranking (tsvector português)

### 3. Página de Links
- Grupos de links organizáveis com temas (13+ temas)
- Cards configuráveis (altura, cor, borda, gradiente)
- Tracking de cliques via Edge Function
- Links internos vinculados a eventos (atualizam automaticamente)
- Ordenação manual com drag & drop (DnD Kit, lazy loaded)
- Skeleton loading e ícones estáticos para performance
- Cache Service Worker (Stale-While-Revalidate)

### 4. Redirecionador de Links
- Links curtos: `mdaccula.com/r/:slug`
- UTM tracking automático (source, medium, campaign, content)
- Contagem de cliques atômica via Edge Function
- Painel admin com criação, edição e toggle enable/disable

### 5. Newsletter
- Popup com teste A/B (variantes configuráveis)
- Gestão de inscritos com rate limiting
- Envio em massa via Resend
- Analytics de conversão por variante

### 6. Programa de Podcast (MDAccula Radio)
- Página pública com hero, "Como Funciona", benefícios
- Formulário validado com Zod (13+ campos)
- Notificação automática: email ao artista + email à agência
- Dashboard admin com filtros, métricas e exportação CSV

### 7. Analytics
- Views de posts/eventos (deduplicação por IP hash)
- Cliques em links e redirects
- Compartilhamentos por plataforma
- Custo de geração IA (tokens input/output/imagem)
- Dashboard de saúde do sistema

### 8. Importação de Dados
- Upload e processamento de CSV
- Suporte a eventos, links, blog posts, prompt templates

---

## Configurações e Secrets

### Secrets (Edge Functions)

| Secret | Uso | Obrigatório |
|--------|-----|-------------|
| `LOVABLE_API_KEY` | API Lovable AI (Gemini) | ✅ Auto |
| `OPENAI_API_KEY` | API OpenAI (GPT) | ❌ Opcional |
| `FIRECRAWL_API_KEY` | Scraping de notícias | ❌ Opcional |
| `RESEND_API_KEY` | Envio de emails | ✅ Para emails |

### Configurações em `site_settings`

| Key | Descrição | Exemplo |
|-----|-----------|---------|
| `ai_blog_model` | Modelo IA para artigos | `google/gemini-2.5-flash` |
| `ai_temperature` | Temperatura do modelo | `0.9` |
| `ai_history_limit` | Limite de histórico | `15` |
| `ai_auto_generate_enabled` | Geração automática | `true` |
| `ai_auto_generate_interval_hours` | Intervalo em horas | `6` |
| `timezone_offset` | Offset do fuso | `-3` |
| `event_grace_hours` | Tolerância visibilidade | `6` |
| `links_page_theme` | Tema da página links | `neonPurple` |
| `links_page_card_default_height` | Altura padrão cards | `100` |

---

## Padrões de Código

> **Documentação completa:** [`docs/CODE_STYLE.md`](docs/CODE_STYLE.md)

### Imports (Ordem Obrigatória)

```typescript
// 1. React
import { useState, useEffect } from "react";
// 2. Bibliotecas externas
import { useQuery } from "@tanstack/react-query";
// 3. Componentes UI
import { Button } from "@/components/ui/button";
// 4. Hooks (via barrel export)
import { useAuth, useToast } from "@/hooks";
// 5. Lib/Utils (via barrel export)
import { cn, logger } from "@/lib";
// 6. Supabase
import { supabase } from "@/integrations/supabase/client";
// 7. Tipos
import type { CustomLink } from "@/types";
```

### Logger Centralizado

```typescript
import { logger } from "@/lib";

logger.info("Operação completada", { context: "value" });
logger.error("Falha na operação", error, { component: "EventCard" });
// ❌ Evitar console.log em produção
```

### Edge Functions

Todas devem usar módulos de `supabase/functions/_shared/`:

```typescript
import {
  handleCorsPreFlight, withTimeout, isRateLimited,
  getClientIP, jsonSuccess, handleError,
} from "../_shared/index.ts";
```

---

## Regras de Negócio Importantes

### 1. Visibilidade de Eventos

```typescript
import { isEventVisible } from "@/lib";
const visible = isEventVisible(event, { timezoneOffset: -3, graceHours: 6 });
```

### 2. Parsing de Datas (Timezone)

```typescript
import { parseLocalDate } from "@/lib/utils";
const date = parseLocalDate("2025-12-25"); // ✅ Correto
// const date = new Date("2025-12-25");   // ❌ Mostra dia anterior
```

### 3. Imagens: CDN com Fallback

```typescript
import { getOptimizedImageUrl, getOriginalSupabaseUrl } from "@/lib/imageUtils";
// CDN → Supabase → placeholder (3 camadas de fallback)
```

### 4. Click Tracking

Usa Edge Functions para bypass de RLS em operações anônimas.

---

## Setup e Desenvolvimento

### Requisitos

- Node.js 18+ / Bun
- npm ou bun

### Setup Local

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

### Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run build:dev` | Build modo desenvolvimento |
| `npm run lint` | Verificar erros ESLint |
| `npm run preview` | Preview do build |

### Adicionando Nova Página

1. Criar `src/pages/NovaPagina.tsx`
2. Adicionar rota lazy em `src/App.tsx`:
```typescript
const NovaPagina = lazy(() => import("./pages/NovaPagina"));
<Route path="/nova-pagina" element={<PageWithError name="Nova Página"><NovaPagina /></PageWithError>} />
```

### Adicionando Nova Tabela

1. Criar SQL via migration tool
2. Incluir RLS policies
3. Documentar em `tabelas.md`
4. Tipos gerados automaticamente em `types.ts`

### Adicionando Nova Edge Function

1. Criar pasta `supabase/functions/nome-funcao/index.ts`
2. Usar módulos `_shared/` (CORS, rate limiting, etc)
3. Deploy automático via Lovable

---

## Deploy e Cache

### Processo de Deploy

1. **Incrementar versão do Service Worker** em `public/service-worker.js` (`CACHE_VERSION`)
2. **Publicar no Lovable** → Share → Publish → Update
3. **Testar:** Hard refresh (Ctrl+Shift+R) ou limpar dados do site

### Estratégia de Cache

| Tipo | Estratégia | TTL |
|------|-----------|-----|
| HTML | Network-First | Sempre fresco |
| JS/CSS/Fontes | Cache-First | 30 dias |
| Imagens | Stale-While-Revalidate | Background update |
| API Links | Stale-While-Revalidate | Background update |
| React Query | In-memory | 5 min (staleTime) |
| Site Settings | localStorage + revalidate | 15 min |

---

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| Eventos desaparecem cedo | Timezone/grace_hours errados | Verificar `site_settings` |
| Cliques não registram | RLS bloqueando anônimos | Usar Edge Function |
| Data mostra dia anterior | `new Date()` interpreta UTC | Usar `parseLocalDate()` |
| Tipos desatualizados | `types.ts` auto-gerado | Aguardar regeneração |
| Edge Function 500 | Erro no Deno | Ver Edge Function Logs |
| Imagens não carregam (CDN) | Cache corrompido no Bunny | Purge cache + fallback automático |
| Imagens não carregam (Storage) | Bucket sem policy pública | Verificar policies do bucket |
| Admin sem acesso | Role não configurada | Inserir em `user_roles` |

---

## 📚 Documentos Relacionados

| Documento | Descrição |
|-----------|-----------|
| [docs/PRD.md](docs/PRD.md) | Product Requirements Document |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Roadmap de desenvolvimento |
| [PENDENCIAS.MD](PENDENCIAS.MD) | Pendências e histórico |
| [docs/CODE_STYLE.md](docs/CODE_STYLE.md) | Guia de estilo de código |
| [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) | Auditoria de segurança |
| [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) | Arquitetura técnica e fluxos de dados |
| [tabelas.md](tabelas.md) | Documentação do banco de dados |

---

*Última atualização: 15/03/2026*
