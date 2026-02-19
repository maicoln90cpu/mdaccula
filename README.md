# MDAccula - Electronic Music Agency Platform

> Sistema completo para agência de música eletrônica com gestão de eventos, blog com IA, links personalizáveis, eventos recorrentes automatizados, programa de podcast e analytics.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Status](https://img.shields.io/badge/Status-Fase%202%20Consolidação-blue)

**URL do Projeto:** https://lovable.dev/projects/5fbf20d7-2f06-4b9e-8486-f99fd516e773  
**Domínio:** https://mdaccula.com  
**Versão:** 1.2.0 | **Última atualização:** 23/01/2026

---

## 📚 Documentação Completa

| Documento | Descrição |
|-----------|-----------|
| [📋 PRD.md](docs/PRD.md) | Requisitos do produto, objetivos e backlog |
| [🗺️ ROADMAP.md](docs/ROADMAP.md) | Fases de desenvolvimento e cronograma |
| [📝 PENDENCIAS.MD](PENDENCIAS.MD) | Tarefas pendentes e histórico de mudanças |
| [🎨 CODE_STYLE.md](docs/CODE_STYLE.md) | Guia de estilo e convenções de código |
| [🔒 SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) | Auditoria de segurança e políticas RLS |
| [🗃️ tabelas.md](tabelas.md) | Documentação SQL do banco de dados |

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Arquitetura do Projeto](#arquitetura-do-projeto)
4. [Estrutura de Pastas](#estrutura-de-pastas)
5. [Banco de Dados](#banco-de-dados)
6. [Edge Functions](#edge-functions)
7. [Sistema de Autenticação](#sistema-de-autenticação)
8. [Design System](#design-system)
9. [Funcionalidades Principais](#funcionalidades-principais)
10. [Configurações e Secrets](#configurações-e-secrets)
11. [Padrões de Código](#padrões-de-código)
12. [Regras de Negócio Importantes](#regras-de-negócio-importantes)
13. [Contribuição](#contribuição)
14. [Como Continuar o Desenvolvimento](#como-continuar-o-desenvolvimento)
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
- **Analytics** de visualizações, cliques e engajamento
- **Newsletter** com testes A/B
- **Carousel mobile** para próximos eventos

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
| `/admin/*` | Painel administrativo (requer autenticação) |
| `/admin/recurring-events` | Gerenciador de eventos recorrentes |
| `/admin/mdaccula-radio` | Gerenciador de inscrições do MDAccula Radio |

---

## Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | ^18.3 | Framework principal |
| TypeScript | ^5.0 | Tipagem estática |
| Vite | ^5.0 | Build tool |
| Tailwind CSS | ^3.0 | Estilização |
| React Router DOM | ^6.30 | Roteamento |
| TanStack Query | ^5.83 | Gerenciamento de estado servidor |
| React Hook Form | ^7.61 | Formulários |
| Zod | ^3.25 | Validação de schemas |
| Recharts | ^2.15 | Gráficos |
| Shadcn/UI | - | Componentes UI |

### Backend (Lovable Cloud / Supabase)
| Componente | Descrição |
|------------|-----------|
| PostgreSQL | Banco de dados relacional |
| Edge Functions (Deno) | Lógica serverless |
| Row Level Security (RLS) | Segurança a nível de linha |
| Realtime | Subscriptions (habilitado para algumas tabelas) |
| Storage | Armazenamento de imagens |

### Integrações Externas
| Serviço | Uso |
|---------|-----|
| OpenAI API | Geração de artigos (GPT-4.1 mini, GPT-5 mini) |
| Lovable AI | Geração de artigos (Gemini 2.5) |
| Firecrawl | Scraping de notícias para IA |
| Resend | Envio de emails (newsletter, contato) |
| Google Tag Manager | Analytics |
| Hotjar | Heatmaps e gravações |

---

## Arquitetura do Projeto

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  Pages          │  Components       │  Hooks                     │
│  ├── Index      │  ├── ui/          │  ├── useAuth              │
│  ├── Eventos    │  ├── sections/    │  ├── useSiteSettings      │
│  ├── Blog       │  ├── admin/       │  └── use-toast            │
│  ├── Links      │  ├── events/      │                           │
│  └── Admin/*    │  └── links/       │                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Lovable Cloud)                      │
├─────────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL)    │  Edge Functions     │  Storage      │
│  ├── events               │  ├── generate-blog- │  ├── event-   │
│  ├── blog_posts           │  │   post-v2        │  │   images   │
│  ├── custom_links         │  ├── generate-blog- │  └── team-    │
│  ├── profiles             │  │   suggestions    │      images   │
│  ├── user_roles           │  ├── auto-generate- │               │
│  ├── site_settings        │  │   article        │               │
│  └── ...17 tabelas        │  └── ...15 funções  │               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estrutura de Pastas

```
├── src/
│   ├── assets/              # Imagens estáticas
│   ├── components/
│   │   ├── ui/              # Componentes Shadcn/UI
│   │   │   ├── badge.tsx    # Badge com variantes (success, warning, priority-*)
│   │   │   ├── button.tsx   # Botão padrão
│   │   │   ├── card.tsx     # Card com variantes (metric, alert, success, etc)
│   │   │   ├── table.tsx    # Tabela com variantes (striped, bordered, compact)
│   │   │   └── ...          # ~50 componentes UI
│   │   ├── admin/           # Componentes exclusivos do admin
│   │   ├── blog/            # Componentes do blog
│   │   ├── events/          # Componentes de eventos
│   │   ├── links/           # Componentes da página de links
│   │   ├── sections/        # Seções da homepage (Hero, FeaturedEvents, etc)
│   │   └── *.tsx            # Componentes globais (SEO, Newsletter, etc)
│   ├── hooks/
│   │   ├── useAuth.tsx      # Autenticação e contexto de usuário
│   │   ├── useSiteSettings.tsx # Configurações do site (site_settings)
│   │   └── use-toast.ts     # Sistema de notificações
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts    # Cliente Supabase (NÃO EDITAR)
│   │       └── types.ts     # Tipos do banco (NÃO EDITAR)
│   ├── lib/
│   │   ├── utils.ts         # Funções utilitárias (cn, parseLocalDate)
│   │   ├── eventDateHelper.ts # Lógica de visibilidade de eventos por timezone
│   │   ├── linkThemes.ts    # Temas para página de links
│   │   └── eventGroupHelper.ts # Helpers para grupos de links
│   ├── pages/
│   │   ├── admin/           # Páginas do painel admin
│   │   │   ├── Settings.tsx # Configurações gerais e IA
│   │   │   ├── EventsManager.tsx # CRUD de eventos
│   │   │   ├── BlogManager.tsx # CRUD de posts
│   │   │   ├── LinksManager.tsx # CRUD de links
│   │   │   └── ...
│   │   └── *.tsx            # Páginas públicas
│   ├── App.tsx              # Roteamento principal
│   ├── index.css            # Design System CSS completo
│   └── main.tsx             # Entry point
├── supabase/
│   ├── config.toml          # Configuração Supabase (NÃO EDITAR)
│   └── functions/           # Edge Functions (Deno)
│       ├── generate-blog-post-v2/
│       ├── generate-blog-suggestions/
│       ├── auto-generate-article/
│       ├── send-contact-email/
│       ├── send-mass-newsletter/
│       ├── track-link-click/
│       └── ...
├── public/
│   ├── service-worker.js    # PWA e cache (Network-First strategy)
│   └── robots.txt
├── tailwind.config.ts       # Configuração Tailwind com tokens customizados
└── tabelas.md               # Documentação SQL para recriar banco do zero
```

---

## Banco de Dados

### Tabelas Principais (19 tabelas)

| Tabela | Descrição | RLS |
|--------|-----------|-----|
| `events` | Eventos da agência | ✅ Público leitura, Admin CRUD |
| `recurring_event_configs` | Configurações de eventos recorrentes | ✅ Admin apenas |
| `blog_posts` | Artigos do blog | ✅ Publicados = público, Admin CRUD |
| `custom_links` | Links personalizáveis | ✅ Habilitados = público, Admin CRUD |
| `link_groups` | Grupos de links | ✅ Habilitados = público |
| `profiles` | Perfis de usuários | ✅ Próprio usuário apenas |
| `user_roles` | Roles (admin, moderator, user) | ✅ Próprio usuário apenas |
| `site_settings` | Configurações key-value | ✅ Público leitura, Admin CRUD |
| `team_members` | Membros da equipe | ✅ Ativos = público |
| `event_templates` | Templates de eventos | ✅ Admin apenas |
| `ai_prompt_templates` | Templates de prompts IA | ✅ Admin apenas |
| `ai_generated_posts` | Logs de geração IA | ✅ Admin apenas |
| `newsletter_subscribers` | Inscritos newsletter | ✅ Insert público, Admin leitura |
| `newsletter_popup_variants` | Variantes A/B | ✅ Habilitados = público |
| `newsletter_popup_analytics` | Analytics popup | ✅ Insert público |
| `news_sources` | Fontes de notícias para IA | ✅ Admin apenas |
| `share_analytics` | Analytics de compartilhamentos | ✅ Insert público |
| `sync_logs` | Logs de sincronização | ✅ Admin leitura |
| `podcast_submissions` | Inscrições do programa de podcast | ✅ Insert público, Admin CRUD |

### Funções SQL Importantes

```sql
-- Verifica se usuário tem role específica
has_role(user_id, role_name) → boolean

-- Incrementa views/clicks atomicamente
increment_post_views(post_id)
increment_event_views(event_id)  
increment_link_clicks(link_id)

-- Toggle de likes
toggle_post_like(post_id) → {liked: boolean, total_likes: number}

-- Busca full-text no blog
search_blog_posts(search_query, category_filter?, limit?, offset?)
```

### Diagrama de Relacionamentos

```
events ──────────── event_templates (1:N para template base)
   │
   └──────── blog_posts (1:1 via blog_post_id)
   
custom_links ────── link_groups (N:1 via group_id)
        │
        └────── events (N:1 via event_id - opcional)
        
profiles ────────── auth.users (1:1 via id)
user_roles ──────── auth.users (N:1 via user_id)
```

---

## Edge Functions

### Funções de Geração de Conteúdo IA

| Função | Descrição |
|--------|-----------|
| `generate-blog-suggestions` | Gera 5 sugestões de artigos baseado em news_sources |
| `generate-blog-post-v2` | Gera artigo completo + imagem opcional |
| `auto-generate-article` | Execução automática via cron (pg_cron) |
| `auto-article-cron` | Versão sem JWT para cron jobs |
| `regenerate-blog-image` | Regenera imagem de artigo existente |

### Funções de Automação

| Função | Descrição |
|--------|-----------|
| `create-recurring-events` | Cria eventos recorrentes semanais (D.EDGE) |

### Funções de Email

| Função | Descrição |
|--------|-----------|
| `send-contact-email` | Envia email do formulário de contato |
| `send-mass-newsletter` | Envia newsletter em batch |
| `send-podcast-notification` | Envia confirmação ao artista e notificação à agência |

### Funções de Tracking

| Função | Descrição |
|--------|-----------|
| `track-link-click` | Registra clique em link (bypassa RLS) |
| `track-view` | Registra visualização |
| `track-share` | Registra compartilhamento |

### Funções Utilitárias

| Função | Descrição |
|--------|-----------|
| `sitemap` | Gera sitemap.xml dinâmico |
| `blog-rss` | Gera feed RSS do blog |
| `sync-to-external` | Sincroniza dados para Supabase externo |
| `convert-to-webp` | Converte imagens para WebP |
| `batch-convert-webp` | Conversão em lote para WebP |
| `fetch-link-metadata` | Busca metadados de URLs |
| `systemhealth` | Verifica saúde do sistema |
| `cleanup-sync-logs` | Limpa logs antigos de sincronização |

---

## Sistema de Autenticação

### Fluxo de Autenticação

```
1. Usuário acessa /login ou /auth
2. Pode fazer sign up ou sign in
3. Email auto-confirmado (configuração Supabase)
4. Após login, hook useAuth verifica user_roles
5. Se role = 'admin', isAdmin = true
6. Rotas /admin/* verificam isAdmin
```

### Estrutura do AuthContext

```typescript
interface AuthContextType {
  user: User | null;           // Usuário Supabase
  session: Session | null;     // Sessão ativa
  profile: Profile | null;     // Dados do perfil (full_name, phone)
  isAdmin: boolean;            // Verificado via user_roles
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

## Design System

### Tokens de Cor (index.css)

```css
:root {
  /* Cores base */
  --background: 220 25% 5%;      /* Fundo escuro */
  --foreground: 0 0% 95%;        /* Texto claro */
  
  /* Paleta Neon */
  --primary: 280 100% 50%;       /* Roxo neon */
  --secondary: 200 100% 38%;     /* Azul neon */
  --accent: 320 100% 65%;        /* Rosa neon */
  
  /* Estados */
  --muted: 220 25% 15%;
  --destructive: 0 84.2% 60.2%;
  
  /* Gradientes */
  --gradient-hero: linear-gradient(135deg, hsl(var(--neon-purple)) 0%, hsl(var(--neon-blue)) 100%);
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
| `.table-striped` | Tabela zebrada |

### Variantes de Componentes

**Badge:**
```tsx
<Badge variant="success">Ativo</Badge>
<Badge variant="warning">Pendente</Badge>
<Badge variant="priority-high">Alta Prioridade</Badge>
<Badge variant="priority-medium">Média Prioridade</Badge>
<Badge variant="priority-low">Baixa Prioridade</Badge>
<Badge variant="info">Informação</Badge>
```

**Card:**
```tsx
<Card variant="default">Padrão</Card>
<Card variant="metric">KPI Card</Card>
<Card variant="alert">Alerta</Card>
<Card variant="success">Sucesso</Card>
<Card variant="warning">Aviso</Card>
<Card variant="info">Info</Card>
<Card variant="featured">Destaque</Card>
<Card variant="ghost">Transparente</Card>
```

**Table:**
```tsx
<Table variant="striped">...</Table>
<Table variant="bordered">...</Table>
<Table variant="compact">...</Table>
```

---

## Funcionalidades Principais

### 1. Gestão de Eventos
- CRUD completo de eventos
- Templates reutilizáveis
- **Eventos recorrentes automatizados (D.EDGE)**
- Integração com blog (post automático)
- Filtros por cidade/estado/gênero
- Visibilidade baseada em timezone + grace hours
- **Carousel mobile para próximos eventos**

### 2. Blog com IA
- Geração de sugestões via news_sources
- Geração de artigos com múltiplos modelos IA
- Geração automática de imagens (Nano Banana)
- **Prompt de imagem aprimorado com 6 variáveis**
- Agendamento automático via cron
- Analytics de tokens e custos
- Regeneração de imagens individuais

### 3. Página de Links
- Grupos de links organizáveis
- Temas personalizáveis (13+ temas)
- Cards configuráveis (altura, cor, borda)
- Tracking de cliques
- Links internos vinculados a eventos
- Ordenação manual com drag & drop

### 4. Newsletter
- Popup com teste A/B
- Gestão de inscritos
- Envio em massa
- Analytics de conversão

### 5. Analytics
- Views de posts/eventos
- Cliques em links
- Compartilhamentos
- Custo de geração IA
- Dashboard de saúde do sistema

### 6. Programa de Podcast
- Página pública com formulário de inscrição
- Validação completa com Zod (13+ campos)
- Notificação automática ao artista via email
- Notificação à agência com detalhes do lead
- Dashboard admin para gerenciamento de inscrições
- Filtros por status (pendente, aprovado, rejeitado, contactado)
- Métricas de conversão e engajamento
- Exportação CSV para análise externa

---

## Configurações e Secrets

### Secrets Necessários

| Secret | Uso | Obrigatório |
|--------|-----|-------------|
| `LOVABLE_API_KEY` | API Lovable AI (Gemini) | ✅ Auto |
| `OPENAI_API_KEY` | API OpenAI (GPT) | ❌ Opcional |
| `FIRECRAWL_API_KEY` | Scraping de notícias | ❌ Opcional |
| `RESEND_API_KEY` | Envio de emails | ✅ Para emails |
| `EXTERNAL_SUPABASE_URL` | Sync externo | ❌ Backup |
| `EXTERNAL_SUPABASE_SERVICE_KEY` | Sync externo | ❌ Backup |

### Configurações em site_settings

| Key | Descrição | Exemplo |
|-----|-----------|---------|
| `ai_blog_model` | Modelo IA para artigos | `google/gemini-2.5-flash` |
| `ai_temperature` | Temperatura do modelo | `0.9` |
| `ai_history_limit` | Limite de histórico | `15` |
| `ai_auto_generate_enabled` | Geração automática | `true` |
| `ai_auto_generate_interval_hours` | Intervalo em horas | `24` |
| `timezone_offset` | Offset do fuso | `-3` |
| `event_grace_hours` | Tolerância visibilidade | `6` |
| `links_page_theme` | Tema da página links | `neonPurple` |
| `links_page_card_default_height` | Altura padrão cards | `100` |

---

## Padrões de Código

> **Documentação completa:** Consulte [`docs/CODE_STYLE.md`](docs/CODE_STYLE.md) para o guia detalhado.

### Ferramentas de Qualidade

| Ferramenta | Arquivo de Config | Comando |
|------------|-------------------|---------|
| ESLint | `eslint.config.js` | `npm run lint` |
| Prettier | `.prettierrc` | `npm run format` |

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

// ✅ Usar logger ao invés de console.log
logger.info("Operação completada", { context: "value" });
logger.error("Falha na operação", error, { component: "EventCard" });

// ❌ Evitar console.log em produção
```

### Edge Functions

Todas as Edge Functions devem usar os módulos compartilhados em `supabase/functions/_shared/`:

```typescript
import {
  handleCorsPreFlight,
  withTimeout,
  isRateLimited,
  getClientIP,
  jsonSuccess,
  handleError,
} from "../_shared/index.ts";
```

---

## Regras de Negócio Importantes

### 1. Visibilidade de Eventos

```typescript
import { isEventVisible } from "@/lib";

const visible = isEventVisible(event, { 
  timezoneOffset: -3, 
  graceHours: 6 
});
```

### 2. Parsing de Datas (Timezone)

```typescript
import { parseLocalDate } from "@/lib";

const date = parseLocalDate("2025-12-25"); // ✅ Correto
// const date = new Date("2025-12-25");   // ❌ Mostra dia anterior
```

### 3. Click Tracking

Use Edge Functions para tracking de usuários anônimos (bypassa RLS).

---

## Contribuição

### Requisitos

- Node.js 18+
- npm ou bun

### Setup Local

```bash
# Clone o repositório
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Instale dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

### Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | Verificar erros ESLint |
| `npm run lint:fix` | Corrigir erros ESLint automaticamente |
| `npm run format` | Formatar código com Prettier |
| `npm run format:check` | Verificar formatação |

### Checklist de Pull Request

- [ ] ESLint sem erros (`npm run lint`)
- [ ] Código formatado (`npm run format`)
- [ ] Sem tipos `any`
- [ ] Sem `console.log` (usar `logger`)
- [ ] Tratamento de erros adequado
- [ ] Imports na ordem correta
- [ ] Edge Functions usando `_shared/`
- [ ] Atualizar `PENDENCIAS.MD` se necessário

### Guia de Estilo

Consulte [`docs/CODE_STYLE.md`](docs/CODE_STYLE.md) para o guia completo de convenções.

---

## Como Continuar o Desenvolvimento

### Desenvolvimento Local

```sh
# Clone o repositório
git clone <YOUR_GIT_URL>

# Navegue até o diretório
cd <YOUR_PROJECT_NAME>

# Instale as dependências
npm i

# Inicie o servidor de desenvolvimento
npm run dev
```

### Adicionando Nova Página

1. Criar arquivo em `src/pages/NovaPagina.tsx`
2. Adicionar rota lazy em `src/App.tsx`:
```typescript
const NovaPagina = lazy(() => import("./pages/NovaPagina"));
// ...
<Route path="/nova-pagina" element={<NovaPagina />} />
```
3. Se admin, adicionar verificação `isAdmin`

### Adicionando Nova Tabela

1. Criar SQL via migration tool (nunca editar types.ts)
2. Incluir RLS policies apropriadas
3. Documentar em `tabelas.md`

### Adicionando Nova Edge Function

1. Criar pasta em `supabase/functions/nome-funcao/`
2. Criar `index.ts` com estrutura:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Lógica
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```
3. Deploy é automático

### Modificando Design System

1. Cores/tokens → `src/index.css` (seção `:root`)
2. Variantes de componentes → arquivos em `src/components/ui/`
3. Animações → `tailwind.config.ts` (keyframes)

---

## Deploy e Cache

### Como Garantir Atualização em Todos os Dispositivos

Após fazer deploy:

1. **Incrementar versão do Service Worker**:
   - Editar `public/service-worker.js`
   - Alterar `CACHE_VERSION` (ex: 'v2' → 'v3')

2. **Publicar no Lovable**:
   - Clicar em "Share" → "Publish" → "Update"
   - Aguardar alguns minutos para propagação

3. **Testar em dispositivos**:
   - **Desktop**: Hard refresh (Ctrl+Shift+R no Windows/Linux, Cmd+Shift+R no Mac)
   - **Mobile**: Fechar o app/navegador completamente e reabrir
   - As mudanças devem aparecer em 1-2 minutos (não 24h como antes)

4. **Solução rápida para testes**:
   - Mobile: Configurações do navegador → Limpar dados do site mdaccula
   - Desktop: DevTools (F12) → Application → Clear storage

### Estratégia de Cache

O projeto usa **Network-First strategy**:
- Sempre busca conteúdo atualizado da rede primeiro
- Usa cache apenas se estiver offline
- Cache expira em 1 hora
- Service worker atualiza automaticamente quando a versão muda

---

## Troubleshooting

### Problema: Eventos desaparecem cedo demais
**Causa:** Timezone ou grace_hours incorretos
**Solução:** Verificar `site_settings.timezone_offset` e `event_grace_hours`

### Problema: Cliques não são registrados
**Causa:** RLS bloqueando usuários anônimos
**Solução:** Usar Edge Function `track-link-click`

### Problema: Data mostra dia anterior
**Causa:** `new Date()` interpreta string como UTC
**Solução:** Usar `parseLocalDate()` de `@/lib/utils`

### Problema: Tipos do Supabase desatualizados
**Causa:** `types.ts` é gerado automaticamente
**Solução:** Aguardar regeneração após migration

### Problema: Edge Function retorna 500
**Solução:** Verificar logs em Lovable Cloud → Edge Function Logs

### Problema: Imagens não carregam
**Causa:** Bucket Storage sem policy pública
**Solução:** Verificar policies do bucket `event-images`

### Problema: Admin não consegue acessar painel
**Causa:** Role não configurada no banco
**Solução:** Inserir role admin na tabela `user_roles`

---

## Arquivos Importantes para Referência

| Arquivo | Descrição |
|---------|-----------|
| `tabelas.md` | SQL completo para recriar banco do zero |
| `fix-rls-policies.sql` | Policies para sync externo |
| `src/index.css` | Design System CSS completo |
| `tailwind.config.ts` | Tokens e animações Tailwind |

---

## Contato e Suporte

- **Plataforma:** [Lovable](https://lovable.dev/projects/5fbf20d7-2f06-4b9e-8486-f99fd516e773)
- **Documentação Lovable:** https://docs.lovable.dev
- **Domínio:** https://mdaccula.com

---

## 📚 Documentos Relacionados

| Documento | Descrição |
|-----------|-----------|
| [docs/PRD.md](docs/PRD.md) | Product Requirements Document |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Roadmap de desenvolvimento |
| [PENDENCIAS.MD](PENDENCIAS.MD) | Pendências e histórico |
| [docs/CODE_STYLE.md](docs/CODE_STYLE.md) | Guia de estilo de código |
| [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) | Auditoria de segurança |
| [tabelas.md](tabelas.md) | Documentação do banco de dados |
| [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) | Arquitetura técnica e fluxos de dados |

---

*Última atualização: 23/01/2026*
