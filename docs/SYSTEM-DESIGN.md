# System Design Document - MDAccula

> Arquitetura técnica, fluxos de dados, APIs e interfaces do sistema

**Versão:** 1.0  
**Data:** 23/01/2026  
**Status:** Ativo

---

## 📋 Índice

1. [Visão Arquitetural](#visão-arquitetural)
2. [Diagrama de Componentes](#diagrama-de-componentes)
3. [Fluxos de Dados](#fluxos-de-dados)
4. [APIs e Endpoints](#apis-e-endpoints)
5. [Banco de Dados](#banco-de-dados)
6. [Edge Functions](#edge-functions)
7. [Autenticação e Autorização](#autenticação-e-autorização)
8. [Integrações Externas](#integrações-externas)
9. [Cache e Performance](#cache-e-performance)
10. [Segurança](#segurança)

---

## Visão Arquitetural

### Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTE (Browser)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  React SPA │ React Router │ TanStack Query │ Tailwind │ Service Worker      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LOVABLE CLOUD (Supabase)                          │
├───────────────────┬───────────────────┬───────────────────┬─────────────────┤
│   PostgreSQL      │   Edge Functions  │    Storage        │   Realtime      │
│   + RLS Policies  │   (Deno Runtime)  │   (event-images)  │   (websocket)   │
└───────────────────┴───────────────────┴───────────────────┴─────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INTEGRAÇÕES EXTERNAS                                │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  Lovable AI     │   Resend        │   Firecrawl     │   GTM/Hotjar          │
│  (Gemini/GPT)   │   (Emails)      │   (Scraping)    │   (Analytics)         │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
```

### Princípios de Design

| Princípio | Implementação |
|-----------|---------------|
| **Separation of Concerns** | UI em React, lógica em Edge Functions, dados em PostgreSQL |
| **Mobile-First** | Tailwind breakpoints, carousel mobile, touch-friendly |
| **Security by Default** | RLS em todas tabelas, Edge Functions para operações anônimas |
| **Performance** | React Query cache, lazy loading, Service Worker |
| **Maintainability** | TypeScript strict, ESLint, barrel exports, logger centralizado |

---

## Diagrama de Componentes

### Frontend (React)

```
src/
├── pages/                     # Rotas da aplicação
│   ├── Index.tsx             # Homepage
│   ├── Eventos.tsx           # Lista de eventos
│   ├── Blog.tsx              # Lista de posts
│   ├── Podcast.tsx           # MDAccula Radio (rota: /MDAcculaRadio)
│   ├── Links.tsx             # Página de links
│   └── admin/                # Painel administrativo
│       ├── EventsManager.tsx
│       ├── BlogManager.tsx
│       ├── PodcastManager.tsx
│       └── Settings.tsx
│
├── components/
│   ├── ui/                   # Componentes Shadcn/UI
│   │   ├── button.tsx
│   │   ├── card.tsx          # Com variantes (metric, alert, etc)
│   │   ├── badge.tsx         # Com variantes (success, warning, etc)
│   │   └── navigation.tsx    # Header com rotas
│   ├── sections/             # Seções da homepage
│   ├── events/               # Componentes de eventos
│   ├── blog/                 # Componentes do blog
│   └── links/                # Componentes de links
│
├── hooks/
│   ├── useAuth.tsx           # Context de autenticação
│   ├── useSiteSettings.tsx   # Configurações globais
│   ├── useEvents.ts          # React Query para eventos
│   ├── useLinks.ts           # React Query para links
│   └── useToast.ts           # Notificações
│
├── lib/
│   ├── utils.ts              # cn(), parseLocalDate()
│   ├── eventDateHelper.ts    # Visibilidade de eventos
│   ├── linkThemes.ts         # Temas da página links
│   └── logger.ts             # Logger centralizado
│
└── contexts/
    └── SiteSettingsContext.tsx  # Provider global de settings
```

### Backend (Edge Functions)

```
supabase/functions/
├── _shared/                       # Módulos compartilhados
│   ├── cors.ts                   # Headers CORS
│   ├── rate-limit.ts             # Rate limiting
│   ├── response.ts               # jsonSuccess, jsonError
│   └── timeout.ts                # fetchWithTimeout
│
├── Geração IA/
│   ├── generate-blog-suggestions/
│   ├── generate-blog-post-v2/
│   ├── generate-multi-event-article/
│   ├── regenerate-blog-image/
│   └── auto-article-cron/
│
├── Automação/
│   └── create-recurring-events/
│
├── Email/
│   ├── send-contact-email/
│   ├── send-mass-newsletter/
│   └── send-podcast-notification/
│
├── Tracking/
│   ├── track-link-click/
│   ├── track-view/
│   └── track-share/
│
└── Utilitários/
    ├── sitemap/
    ├── blog-rss/
    ├── systemhealth/
    └── convert-to-webp/
```

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
                                  │  AuthContext │
                                  │  (isAdmin)   │
                                  └──────────────┘
```

### 2. Fluxo de Geração de Artigo IA

```
┌─────────────┐    ┌────────────────────┐    ┌─────────────────┐
│ Admin UI    │───▶│ generate-blog-     │───▶│ Firecrawl       │
│ (trigger)   │    │ suggestions        │    │ (scrape news)   │
└─────────────┘    └────────────────────┘    └─────────────────┘
                            │
                            ▼
                   ┌────────────────────┐    ┌─────────────────┐
                   │ Lovable AI Gateway │◀──▶│ Gemini/GPT      │
                   │ (generate content) │    │ (AI models)     │
                   └────────────────────┘    └─────────────────┘
                            │
                            ▼
                   ┌────────────────────┐    ┌─────────────────┐
                   │ Supabase Storage   │◀───│ Image Generation│
                   │ (save image)       │    │ (if enabled)    │
                   └────────────────────┘    └─────────────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │ blog_posts table   │
                   │ (save article)     │
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
                   │ Calcular próxima   │
                   │ data (weekday)     │
                   └────────────────────┘
                            │
                            ▼
                   ┌────────────────────┐    ┌─────────────────┐
                   │ Verificar          │───▶│ events table    │
                   │ duplicatas         │    │ (insert if new) │
                   └────────────────────┘    └─────────────────┘
```

---

## APIs e Endpoints

### Edge Functions - Request/Response

#### `POST /functions/v1/send-podcast-notification`

**Request:**
```typescript
{
  id: string;
  full_name: string;
  city: string;
  phone: string;
  project_name: string;
  project_age: string;
  genre: string;
  has_original_track: boolean;
  original_track_link?: string;
  instagram?: string;
  spotify?: string;
  soundcloud?: string;
  tiktok?: string;
  email: string;
  project_description: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  results: {
    artistEmail: { success: boolean; error?: string };
    agencyEmail: { success: boolean; error?: string };
    dbUpdate: { success: boolean; error?: string };
  }
}
```

#### `POST /functions/v1/generate-blog-suggestions`

**Request:**
```typescript
{
  // No body required - uses news_sources from DB
}
```

**Response:**
```typescript
{
  success: boolean;
  suggestions: Array<{
    title: string;
    excerpt: string;
    keywords: string[];
    category: string;
    sourceUrl?: string;
  }>;
  tokensUsed: number;
}
```

#### `POST /functions/v1/track-link-click`

**Request:**
```typescript
{
  linkId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  newClickCount: number;
}
```

---

## Banco de Dados

### Schema Principal

```sql
-- Tabela de Eventos
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  venue TEXT NOT NULL,
  location_city TEXT NOT NULL,
  location_state TEXT NOT NULL,
  genres TEXT[] DEFAULT '{}',
  lineup TEXT[],
  description TEXT,
  image_url TEXT,
  ticket_link TEXT,
  views INTEGER DEFAULT 0,
  blog_post_id UUID REFERENCES blog_posts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Inscrições Podcast
CREATE TABLE podcast_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_age TEXT NOT NULL,
  genre TEXT NOT NULL,
  has_original_track BOOLEAN DEFAULT false,
  original_track_link TEXT,
  instagram TEXT,
  spotify TEXT,
  soundcloud TEXT,
  tiktok TEXT,
  email TEXT NOT NULL,
  project_description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','contacted')),
  admin_notes TEXT,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Índices de Performance

```sql
-- Eventos por data e localização
CREATE INDEX idx_events_date_location ON events(date, location_state, location_city);

-- Blog posts por status e data
CREATE INDEX idx_blog_status_date ON blog_posts(status, created_at DESC);

-- Links por grupo e ordem
CREATE INDEX idx_links_group_order ON custom_links(group_id, display_order);

-- Podcast por status
CREATE INDEX idx_podcast_status ON podcast_submissions(status, created_at DESC);
```

### RLS Policies Pattern

```sql
-- Padrão para tabelas públicas (leitura anônima, escrita admin)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON events FOR SELECT USING (true);
CREATE POLICY "Admin insert" ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin update" ON events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin delete" ON events FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
```

---

## Edge Functions

### Estrutura Padrão

```typescript
// supabase/functions/example-function/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, jsonSuccess, jsonError } from "../_shared/index.ts";

Deno.serve(async (req) => {
  // 1. Handle CORS preflight
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    // 2. Parse request
    const { param1, param2 } = await req.json();

    // 3. Validate input
    if (!param1) {
      return jsonError("param1 is required", 400);
    }

    // 4. Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 5. Business logic
    const { data, error } = await supabase
      .from("table")
      .select("*")
      .eq("id", param1);

    if (error) throw error;

    // 6. Return success
    return jsonSuccess({ data });

  } catch (error) {
    console.error("Error:", error);
    return jsonError(error.message, 500);
  }
});
```

### Timeout Pattern

```typescript
import { fetchWithTimeout } from "../_shared/timeout.ts";

// Para chamadas externas com timeout
const response = await fetchWithTimeout(
  "https://api.external.com/endpoint",
  { method: "POST", body: JSON.stringify(data) },
  30000 // 30 segundos
);
```

---

## Autenticação e Autorização

### Roles

| Role | Permissões |
|------|------------|
| `admin` | CRUD completo em todas as tabelas |
| `moderator` | CRUD em eventos e blog_posts |
| `user` | Leitura pública apenas |

### Verificação de Admin

```typescript
// Frontend
const { isAdmin } = useAuth();

// Backend (Edge Function)
const { data: roles } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", userId)
  .single();

const isAdmin = roles?.role === "admin";

// SQL (RLS Policy)
EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
```

---

## Integrações Externas

### Lovable AI Gateway

```typescript
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash", // ou openai/gpt-5-mini
    messages: [{ role: "user", content: prompt }],
    temperature: 0.9,
    max_tokens: 4000,
  }),
});
```

### Resend (Email)

```typescript
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

await resend.emails.send({
  from: "MDAccula <no-reply@mdaccula.com>",
  to: email,
  subject: "Assunto",
  html: htmlTemplate,
});
```

---

## Cache e Performance

### React Query Config

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutos
      gcTime: 10 * 60 * 1000,      // 10 minutos
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Service Worker Strategy

```javascript
// Network-First para HTML
// Cache-First para assets estáticos
// Stale-While-Revalidate para imagens

const CACHE_VERSION = 'v5';
const CACHES = {
  static: `static-${CACHE_VERSION}`,
  dynamic: `dynamic-${CACHE_VERSION}`,
  images: `images-${CACHE_VERSION}`,
};
```

---

## Segurança

### Checklist de Segurança

- [x] RLS em todas as tabelas
- [x] Edge Functions para operações anônimas
- [x] Validação Zod no frontend
- [x] Rate limiting em Edge Functions
- [x] CORS configurado corretamente
- [x] Secrets em variáveis de ambiente
- [ ] CAPTCHA no formulário de contato
- [ ] Leaked Password Protection

### Padrão de Validação

```typescript
// Frontend: Zod schema
const podcastSchema = z.object({
  full_name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  // ...
});

// Backend: Validação manual
if (!data.email || !data.email.includes("@")) {
  return jsonError("Email inválido", 400);
}
```

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

---

*Última atualização: 23/01/2026*
