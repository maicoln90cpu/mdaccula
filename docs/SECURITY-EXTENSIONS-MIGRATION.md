# Plano de Migração de Extensions para Schema Dedicado

## Status: PLANEJADO (não executado)

### Problema Identificado

O linter de segurança do Supabase detectou que extensões PostgreSQL estão instaladas no schema `public`. Isso pode causar:

1. **Conflitos de namespace** - Funções de extensões podem colidir com funções da aplicação
2. **Superfície de ataque aumentada** - Extensões no schema público são mais expostas
3. **Problemas de manutenção** - Dificulta distinguir objetos da aplicação vs extensões

### Extensões Afetadas

Para identificar as extensões no schema público, execute:

```sql
SELECT extname, extversion, extnamespace::regnamespace as schema
FROM pg_extension
WHERE extnamespace = 'public'::regnamespace;
```

### Plano de Migração

#### Fase 1: Criar Schema Dedicado

```sql
-- Criar schema para extensões
CREATE SCHEMA IF NOT EXISTS extensions;

-- Conceder permissões necessárias
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
```

#### Fase 2: Mover Extensões (Exemplo com pgcrypto)

```sql
-- ATENÇÃO: Algumas extensões não podem ser movidas diretamente
-- É necessário dropar e recriar no novo schema

-- Para extensões que suportam relocação:
ALTER EXTENSION pgcrypto SET SCHEMA extensions;

-- Para extensões que NÃO suportam:
-- 1. Backup de todas as funções que dependem da extensão
-- 2. DROP EXTENSION cascade (PERIGO: remove objetos dependentes)
-- 3. CREATE EXTENSION no novo schema
-- 4. Recriar objetos dependentes
```

#### Fase 3: Atualizar Referências

Após mover extensões, é necessário atualizar:

1. **Funções do banco** que usam funções da extensão
2. **Search path** para incluir o schema `extensions`

```sql
-- Atualizar search_path padrão
ALTER DATABASE postgres SET search_path TO public, extensions;

-- OU adicionar em cada função que usa extensões:
CREATE OR REPLACE FUNCTION my_function()
RETURNS void
LANGUAGE plpgsql
SET search_path TO public, extensions
AS $$ ... $$;
```

### Riscos

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Downtime durante migração | Alta | Executar em janela de manutenção |
| Funções quebradas | Média | Testar em ambiente de staging |
| Perda de dados (cascade drop) | Alta | Backup completo antes da migração |
| Incompatibilidade de extensão | Média | Verificar docs de cada extensão |

### Extensões Comuns no Supabase

| Extensão | Relocável | Notas |
|----------|-----------|-------|
| `uuid-ossp` | Sim | Usada para `gen_random_uuid()` |
| `pgcrypto` | Sim | Criptografia |
| `pg_trgm` | Sim | Busca por similaridade |
| `pgjwt` | Sim | JWT tokens |
| `pg_stat_statements` | Não | Monitoramento |

### Recomendação

**Para o projeto MDAccula:**

1. **Prioridade BAIXA** - Este é um warning, não um erro crítico
2. **Impacto MÍNIMO** - As extensões no Supabase Cloud são gerenciadas
3. **Ação recomendada** - Monitorar, mas não executar migração agora

A migração de extensões deve ser considerada apenas em:
- Projetos com muitas funções customizadas
- Ambientes de produção críticos
- Casos onde há conflitos reais de namespace

### Decisão

[ ] Executar migração
[x] Adiar para futura revisão
[ ] Ignorar (aceitar o warning)

---

**Última revisão:** 2026-01-02
**Responsável:** Equipe Técnica MDAccula
