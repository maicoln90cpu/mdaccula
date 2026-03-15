# Auditoria de Segurança - MDAccula

**Data da última auditoria:** 2026-03-15  
**Responsável:** Sistema automatizado + Revisão manual  
**Status:** ✅ Fase 2 Concluída

---

## 📊 Resumo Executivo

| Categoria | Status | Detalhes |
|-----------|--------|----------|
| RLS Policies | ✅ 25/25 tabelas | 0 vulnerabilidades críticas |
| Rate Limiting | ✅ Implementado | DB triggers + Edge Functions |
| Autenticação | ✅ Seguro | RBAC via `has_role()` SECURITY DEFINER |
| Input Validation | ✅ Implementado | Zod (frontend) + escapeHtml (backend) |
| CORS | ✅ Configurado | Headers padrão em todas Edge Functions |
| CDN | ✅ Configurado | Bunny CDN com fallback Supabase |

---

## 🛡️ Políticas RLS por Tabela

### Tabelas com Dados Sensíveis

#### `profiles`
| Policy | Comando | Condição |
|--------|---------|----------|
| Own profile only | SELECT | `auth.uid() = id` |
| Update own profile | UPDATE | `auth.uid() = id` |
| Insert own profile | INSERT | `auth.uid() = id` |

#### `user_roles`
| Policy | Comando | Condição |
|--------|---------|----------|
| View own roles | SELECT | `auth.uid() = user_id` |

**⚠️ Roles NUNCA armazenadas em profiles ou localStorage.**

#### `newsletter_subscribers`
| Policy | Comando | Condição |
|--------|---------|----------|
| Admins view | SELECT | `has_role('admin')` |
| Anyone subscribe | INSERT | Rate limited (5/IP/hora, 3/email/24h) |

#### `blog_post_likes`
| Policy | Comando | Condição |
|--------|---------|----------|
| Own likes CRUD | SELECT/INSERT/DELETE | `auth.uid() = user_id` |
| Rate limit | - | 10 likes/minuto/usuário |

---

### Tabelas Administrativas

| Tabela | Leitura | Escrita |
|--------|---------|---------|
| `sync_logs` | Admin | Service role |
| `ai_prompt_templates` | Admin | Admin |
| `ai_generated_posts` | Admin | Admin |
| `event_templates` | Admin | Admin |
| `recurring_event_configs` | Admin | Admin |
| `news_sources` | Admin | Admin |
| `application_logs` | Admin | Service role |
| `performance_metrics` | Admin | Service role |

---

### Tabelas Públicas (Leitura)

| Tabela | Leitura Pública | Escrita Admin |
|--------|-----------------|---------------|
| `blog_posts` | `published = true` | ✅ `has_role('admin')` |
| `events` | Todos | ✅ `has_role('admin')` |
| `custom_links` | `enabled = true` | ✅ `has_role('admin')` |
| `link_groups` | `enabled = true` | ✅ `has_role('admin')` |
| `team_members` | `active = true` | ✅ `has_role('admin')` |
| `site_settings` | Todos | ✅ `has_role('admin')` |
| `newsletter_popup_variants` | `enabled = true` | ✅ `has_role('admin')` |
| `redirect_links` | `enabled = true` | ✅ `has_role('admin')` |

---

### Tabelas de Tracking (Insert Público via Edge Function)

| Tabela | Insert | Leitura |
|--------|--------|---------|
| `blog_view_events` | Service role (Edge Fn) | Admin |
| `event_view_events` | Service role (Edge Fn) | Admin |
| `link_click_events` | Service role (Edge Fn) | Admin |
| `redirect_click_events` | Service role (Edge Fn) | Admin |
| `share_analytics` | Service role (Edge Fn) | Admin |
| `newsletter_popup_analytics` | Insert público | Admin |

---

### Tabelas com Insert Público

| Tabela | Condições de Insert |
|--------|-------------------|
| `newsletter_subscribers` | Rate limited, email validado |
| `podcast_submissions` | Público (formulário Zod validado) |

---

## 🚦 Rate Limiting

### Database Level (Triggers)

| Tabela | Limite | Janela |
|--------|--------|--------|
| `newsletter_subscribers` | 5/IP | 1 hora |
| `newsletter_subscribers` | 3/email | 24 horas |
| `blog_post_likes` | 10/usuário | 1 minuto |

### Edge Functions Level

| Função | Limite | Janela |
|--------|--------|--------|
| `send-contact-email` | 3 req | 1 minuto |
| `track-link-click` | 10 req | 1 minuto |
| `track-redirect-click` | 10 req | 1 minuto |
| `track-view` | 10 req | 1 minuto |
| `track-share` | 10 req | 1 minuto |
| `request-data-deletion` | 3 req | 1 hora |

---

## 🔐 Autenticação e Autorização

### Estrutura de Roles

```sql
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
```

### Função de Verificação (SECURITY DEFINER)

```sql
CREATE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
```

**Vantagens:**
- ✅ Evita recursão infinita em policies
- ✅ `SECURITY DEFINER` bypassa RLS da própria tabela
- ✅ Roles separadas da tabela `profiles`
- ✅ Função `is_admin()` como atalho: `has_role(auth.uid(), 'admin')`

---

## 📝 Edge Functions - Segurança

### Headers CORS

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Sanitização de Inputs

```typescript
export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
```

### Endpoints Públicos (sem JWT)

| Endpoint | Rate Limit | Validação |
|----------|------------|-----------|
| `track-view` | ✅ 10/min | postId ou eventId |
| `track-share` | ✅ 10/min | url + platform |
| `track-link-click` | ✅ 10/min | linkId |
| `track-redirect-click` | ✅ 10/min | slug |
| `send-contact-email` | ✅ 3/min | email + name + message |
| `send-podcast-notification` | ❌ | 13+ campos validados |
| `request-data-deletion` | ✅ 3/hora | email |
| `blog-rss` | ❌ | Somente leitura |
| `sitemap` | ❌ | Somente leitura |

### Endpoints Protegidos (JWT obrigatório)

| Endpoint | Uso |
|----------|-----|
| `generate-blog-post-v2` | Geração IA |
| `generate-blog-suggestions` | Sugestões IA |
| `generate-multi-event-article` | Artigo multi-datas |
| `regenerate-blog-image` | Regenerar imagem |
| `send-mass-newsletter` | Newsletter em massa |
| `convert-to-webp` | Conversão de imagem |
| `batch-convert-webp` | Conversão em lote |
| `cleanup-storage` | Limpeza de storage |
| `cleanup-sync-logs` | Limpeza de logs |
| `import-csv-data` | Importação de dados |
| `systemhealth` | Health check |

---

## ⚠️ Pendências

### Leaked Password Protection
**Status:** ⚠️ Desabilitado  
**Ação:** Habilitar em Authentication > Providers > Email no painel Supabase

### CAPTCHA no Contato
**Status:** ⚠️ Não implementado  
**Risco:** Baixo (rate limiting mitiga spam automatizado)

---

## 📋 Checklist de Segurança

### Implementado ✅

- [x] RLS habilitado em todas as 25 tabelas
- [x] Políticas específicas por operação (SELECT, INSERT, UPDATE, DELETE)
- [x] Rate limiting em Edge Functions críticas
- [x] Rate limiting via triggers no banco
- [x] Sanitização de HTML (XSS prevention)
- [x] CORS configurado em todas Edge Functions
- [x] Roles em tabela separada (não em profiles)
- [x] `has_role()` com SECURITY DEFINER
- [x] Unique constraints para prevenir duplicatas
- [x] Hashes para dados sensíveis (IP)
- [x] Validação Zod em formulários públicos
- [x] Edge Functions usam `_shared/` (padrão consistente)
- [x] Secrets em variáveis de ambiente (nunca hardcoded)
- [x] Filtro de links fake na geração IA

### Pendente ⚠️

- [ ] Habilitar Leaked Password Protection
- [ ] CAPTCHA no formulário de contato
- [ ] Rate limiting por fingerprint de dispositivo
- [ ] 2FA (opcional)

---

## 📚 Referências

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Password Security](https://supabase.com/docs/guides/auth/password-security)
- [Edge Functions Security](https://supabase.com/docs/guides/functions/auth)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

## Documentos Relacionados

| Documento | Link |
|-----------|------|
| README.md | [/README.md](/README.md) |
| SYSTEM-DESIGN.md | [/docs/SYSTEM-DESIGN.md](/docs/SYSTEM-DESIGN.md) |
| CODE_STYLE.md | [/docs/CODE_STYLE.md](/docs/CODE_STYLE.md) |
| tabelas.md | [/tabelas.md](/tabelas.md) |

---

*Última auditoria: 15/03/2026*
