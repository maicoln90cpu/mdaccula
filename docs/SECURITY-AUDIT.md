# Auditoria de Segurança - MDAccula

**Data da última auditoria:** 2026-01-06  
**Responsável:** Sistema automatizado + Revisão manual  
**Status:** ✅ Fase 1 Concluída

---

## 📊 Resumo Executivo

| Categoria | Status | Vulnerabilidades |
|-----------|--------|------------------|
| RLS Policies | ✅ Corrigido | 0 críticas |
| Rate Limiting | ✅ Implementado | DB + Edge Functions |
| Autenticação | ✅ Seguro | RBAC via `has_role()` |
| Input Validation | ✅ Implementado | Zod + escapeHtml |
| CORS | ✅ Configurado | Headers padrão |

---

## 🛡️ Políticas RLS por Tabela

### Tabelas com Dados Sensíveis

#### `profiles`
| Policy | Comando | Condição |
|--------|---------|----------|
| Authenticated users can view own profile only | SELECT | `auth.uid() = id` |
| Authenticated users can update own profile | UPDATE | `auth.uid() = id` |
| Authenticated users can insert own profile | INSERT | `auth.uid() = id` |

**Status:** ✅ Bloqueado para anônimos

#### `newsletter_subscribers`
| Policy | Comando | Condição |
|--------|---------|----------|
| Admins can view subscribers | SELECT | `has_role('admin')` |
| Anyone can subscribe | INSERT | `true` (com rate limiting via trigger) |

**Proteções adicionais:**
- ✅ Rate limiting: 5 tentativas/IP/hora
- ✅ Rate limiting: 3 tentativas/email/24h
- ✅ Hashes de IP e email para privacidade

#### `blog_post_likes`
| Policy | Comando | Condição |
|--------|---------|----------|
| Users can view their own likes | SELECT | `auth.uid() = user_id` |
| Users can insert their own likes | INSERT | `auth.uid() = user_id` |
| Users can delete their own likes | DELETE | `auth.uid() = user_id` |

**Proteções adicionais:**
- ✅ Unique constraint: `(user_id, post_id)`
- ✅ Rate limiting: 10 likes/minuto/usuário

---

### Tabelas Administrativas

#### `sync_logs`
| Policy | Comando | Condição |
|--------|---------|----------|
| Only service role can manage sync_logs | ALL | `service_role` |
| Admins can view sync_logs | SELECT | `has_role('admin')` |

**Status:** ✅ Bloqueado para anônimos e usuários comuns

#### `share_analytics`
| Policy | Comando | Condição |
|--------|---------|----------|
| Only service role can insert share analytics | INSERT | `service_role` |
| Admins can view share analytics | SELECT | `has_role('admin')` |

---

### Tabelas Públicas (Leitura)

| Tabela | Leitura Pública | Escrita Admin |
|--------|-----------------|---------------|
| `blog_posts` | ✅ `published = true` | ✅ `has_role('admin')` |
| `events` | ✅ Todos | ✅ `has_role('admin')` |
| `custom_links` | ✅ `enabled = true` | ✅ `has_role('admin')` |
| `link_groups` | ✅ `enabled = true` | ✅ `has_role('admin')` |

---

## 🚦 Rate Limiting Implementado

### Database Level (Triggers)

| Tabela | Limite | Janela |
|--------|--------|--------|
| `newsletter_subscribers` | 5/IP | 1 hora |
| `newsletter_subscribers` | 3/email | 24 horas |
| `blog_post_likes` | 10/usuário | 1 minuto |

### Edge Functions Level

| Função | Limite | Janela |
|--------|--------|--------|
| `send-contact-email` | 3 requisições | 1 minuto |
| `track-link-click` | 10 requisições | 1 minuto |
| `track-view` | 10 requisições | 1 minuto |
| `track-share` | 10 requisições | 1 minuto |
| `request-data-deletion` | 3 requisições | 1 hora |

---

## 🔐 Autenticação e Autorização

### Estrutura de Roles

```sql
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE user_roles (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
```

### Função de Verificação

```sql
CREATE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

**Vantagens:**
- ✅ Evita recursão infinita em policies
- ✅ `SECURITY DEFINER` bypassa RLS
- ✅ Roles separadas da tabela `profiles`

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
// Usado em send-contact-email
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

### Endpoints Públicos

| Endpoint | JWT | Rate Limit | Validação |
|----------|-----|------------|-----------|
| `track-view` | ❌ | ✅ | ✅ postId/eventId |
| `track-share` | ❌ | ✅ | ✅ url/platform |
| `track-link-click` | ❌ | ✅ | ✅ linkId |
| `send-contact-email` | ❌ | ✅ | ✅ email/name/message |
| `request-data-deletion` | ❌ | ✅ | ✅ email |
| `blog-rss` | ❌ | ❌ | ❌ (somente leitura) |
| `sitemap` | ❌ | ❌ | ❌ (somente leitura) |

### Endpoints Protegidos

| Endpoint | JWT | Uso |
|----------|-----|-----|
| `generate-blog-post` | ✅ | Geração IA |
| `generate-blog-post-v2` | ✅ | Geração IA v2 |
| `generate-blog-suggestions` | ✅ | Sugestões IA |
| `auto-generate-article` | ✅ | Auto-geração |
| `sync-to-external` | ✅ | Sincronização |
| `send-mass-newsletter` | ✅ | Newsletter |
| `convert-to-webp` | ✅ | Conversão imagens |
| `batch-convert-webp` | ✅ | Conversão em lote |
| `cleanup-sync-logs` | ✅ | Limpeza logs |

---

## ⚠️ Alertas Pendentes

### Leaked Password Protection

**Status:** ⚠️ Desabilitado  
**Ação necessária:** Habilitar manualmente no painel Supabase

**Como habilitar:**
1. Acesse Authentication > Providers > Email
2. Ative "Leaked Password Protection"
3. Escolha o nível de proteção desejado

---

## 🔄 Manutenção

### Limpeza Automática

```sql
-- Executar periodicamente para limpar rate limits antigos
SELECT cleanup_old_rate_limits();
```

**Frequência recomendada:** Semanal (via cron ou edge function)

### Monitoramento

- Logs de autenticação: `auth_logs` (Supabase Analytics)
- Logs de banco: `postgres_logs` (Supabase Analytics)
- Logs de edge functions: `function_edge_logs` (Supabase Analytics)

---

## 📋 Checklist de Segurança

### Implementado ✅

- [x] RLS habilitado em todas as tabelas
- [x] Políticas específicas por operação (SELECT, INSERT, UPDATE, DELETE)
- [x] Rate limiting em edge functions críticas
- [x] Rate limiting via triggers no banco
- [x] Sanitização de HTML (XSS prevention)
- [x] CORS configurado
- [x] Roles em tabela separada (não em profiles)
- [x] Função `has_role()` com SECURITY DEFINER
- [x] Unique constraints para prevenir duplicatas
- [x] Hashes para dados sensíveis (IP, email)

### Pendente ⚠️

- [ ] Habilitar Leaked Password Protection
- [ ] Implementar 2FA (opcional)
- [ ] Adicionar CAPTCHA no formulário de contato (recomendado)
- [ ] Rate limiting por fingerprint de dispositivo

---

## 📚 Referências

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Password Security](https://supabase.com/docs/guides/auth/password-security)
- [Edge Functions Security](https://supabase.com/docs/guides/functions/auth)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

*Documento atualizado automaticamente. Última revisão: 2026-01-06*
