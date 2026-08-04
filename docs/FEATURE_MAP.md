# Feature Map

Mapa de funcionalidades do MDAccula, organizado por rota real em `src/App.tsx`. Todas as rotas
(públicas e admin) são `React.lazy` com `Suspense`/skeleton — ver `docs/SYSTEM-DESIGN.md` para
detalhes de arquitetura e `docs/guides/design-system.md` para os tokens visuais usados.

## Rotas públicas

| Rota | Página | Funcionalidade | Status |
|------|--------|-----------------|--------|
| `/` | `Index` | Home — hero com mural de flyers, próximos eventos, últimas matérias do blog | ✅ Ativo |
| `/eventos` | `Eventos` | Listagem de eventos com filtros (busca, cidade, estado, gênero, data), calendário e carrossel | ✅ Ativo |
| `/eventos/:slug` | `EventDetail` | Página de detalhe do evento — ingressos, line-up, mapa, contagem regressiva, compartilhamento | ✅ Ativo |
| `/blog` | `Blog` | Listagem paginada de posts do blog (gerados por IA), com busca e destaque | ✅ Ativo |
| `/blog/:slug` | `BlogPost` | Post individual do blog | ✅ Ativo |
| `/links` | `Links` / `/links/:slug` | Página estilo Linktree com grupos de links personalizáveis | ✅ Ativo |
| `/r/:slug` | `Redirect` | Redirecionador de links curtos com UTM (tracking de clique) | ✅ Ativo |
| `/quem-somos` | `QuemSomos` | Página institucional sobre a agência e time | ✅ Ativo |
| `/contato` | `Contato` | Formulário de contato (envia via edge function `send-contact-email`) | ✅ Ativo |
| `/MDAcculaRadio` (alias `/podcast`) | `Podcast` | Programa de submissão de DJs para o podcast MDAccula Radio | ✅ Ativo |
| `/busca` | `Search` | Busca unificada (eventos + blog) | ✅ Ativo |
| `/privacidade` | `Privacidade` | Política de privacidade / LGPD (com fluxo de solicitação de exclusão de dados) | ✅ Ativo |
| `/login`, `/auth` | `Login`, `Auth` | Autenticação de admin (Supabase Auth) | ✅ Ativo |
| `/analytics` | `Analytics` | Página de analytics (verificar escopo/público-alvo real antes de expandir) | ⚠️ Não auditado nesta rodada |
| `*` | `NotFound` | 404 | ✅ Ativo |

## Painel Admin (`/admin/*`, atrás de `ProtectedRoute`/`AdminLayout`)

| Rota | Página | Funcionalidade | Status |
|------|--------|-----------------|--------|
| `/admin` | `Admin` | Dashboard/hub do painel admin | ✅ Ativo |
| `/admin/events` | `EventsManager` | CRUD de eventos, mesclagem de eventos duplicados | ✅ Ativo |
| `/admin/events-dashboard` | `EventsDashboard` | Métricas e visão consolidada de eventos | ✅ Ativo |
| `/admin/event-templates` | `EventTemplates` | Templates reutilizáveis para criação rápida de eventos | ✅ Ativo |
| `/admin/recurring-events` | `RecurringEventsManager` | Configuração de eventos recorrentes automatizados | ✅ Ativo |
| `/admin/blog` | `BlogManager` | CRUD de posts do blog | ✅ Ativo |
| `/admin/fontes` | `FontesManager` | Fontes/fontes de notícias monitoradas para geração de conteúdo por IA | ✅ Ativo |
| `/admin/ai-content2` | `AIContent2` | Geração de artigos/sugestões de conteúdo via IA | ✅ Ativo |
| `/admin/ai-settings` | `AISettingsPage` | Configuração de prompts e parâmetros de IA | ✅ Ativo |
| `/admin/ai-costs` | `AICostsPage` | Acompanhamento de custo/uso de tokens de IA | ✅ Ativo |
| `/admin/team` | `TeamManager` | CRUD de membros da equipe (exibidos em "Quem Somos") | ✅ Ativo |
| `/admin/settings` | `Settings` | Configurações gerais do site (`site_settings`) | ✅ Ativo |
| `/admin/links-manager` | `LinksManager` | CRUD de grupos/links da página `/links` | ✅ Ativo |
| `/admin/links-analytics` | `LinksAnalytics` | Analytics de cliques em links | ✅ Ativo |
| `/admin/newsletter` | `NewsletterManager` | Gestão de inscritos e popups de newsletter | ✅ Ativo |
| `/admin/newsletter-ab-results` | `NewsletterABResults` | Resultados de teste A/B dos popups de newsletter | ✅ Ativo |
| `/admin/mdaccula-radio` (alias `/admin/podcast`) | `PodcastManager` | Gestão das submissões de DJs para o podcast | ✅ Ativo |
| `/admin/redirects` | `RedirectsManager` | CRUD de links curtos com UTM (`redirect_links`) | ✅ Ativo |
| `/admin/data-import` | `DataImport` | Importação de dados em massa (CSV) | ✅ Ativo |
| `/admin/egress-monitor` | `EgressMonitor` | Monitor de consumo de banda (Bunny CDN + Supabase) e alertas | ✅ Ativo |
| `/admin/email-config` | `EmailConfig` | Configuração e disparo de e-mails via E-goi (automações, envio manual, dashboard) — ver `docs/EDGE_FUNCTIONS.md` (categoria E-mail/E-goi) | ✅ Ativo |
| `/admin/system-health` | `SystemHealth` | Painel de saúde do sistema (logs, erros, métricas) | ✅ Ativo |

## Funcionalidades transversais (não são rotas próprias)

- **Design system dark neon** (Tailwind + Shadcn/UI) — `docs/guides/design-system.md`.
- **Fallback de imagens em 3 camadas** (Bunny CDN → Supabase Storage → placeholder estático) — `src/lib/imageUtils.ts`.
- **PWA / Service Worker** — cache de assets e estratégia por tipo de recurso (ver README.md → "Estratégia de Cache").
- **Tracking anônimo** (views de evento/post, cliques em link/redirect, compartilhamentos) sempre via Edge Function, nunca escrita direta (RLS bloqueia) — ver `docs/EDGE_FUNCTIONS.md` (categoria Tracking/Analytics).
- **SEO**: sitemap dinâmico, RSS, IndexNow, dados estruturados (JSON-LD) — ver `docs/EDGE_FUNCTIONS.md` (categoria SEO/Público).

## Como manter este documento atualizado

Ao adicionar uma rota nova em `src/App.tsx` (seguindo a convenção `docs/CODE_STYLE.md` — página lazy
+ `PageWithError`), adicione uma linha aqui na tabela correspondente (pública ou admin) no mesmo PR.
