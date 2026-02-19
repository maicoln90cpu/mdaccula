-- Criar schema dedicado para extensões
CREATE SCHEMA IF NOT EXISTS extensions;

-- Conceder permissões necessárias
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Mover extensões comuns para o schema extensions
-- Nota: Algumas extensões não podem ser movidas após criação, então recriamos

-- Recriar pg_trgm no schema extensions (se existir)
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Recriar unaccent no schema extensions (se existir)
DROP EXTENSION IF EXISTS unaccent CASCADE;
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- Atualizar search_path para incluir o schema extensions
ALTER DATABASE postgres SET search_path TO public, extensions;

-- Comentário para documentação
COMMENT ON SCHEMA extensions IS 'Schema dedicado para extensões PostgreSQL - seguindo boas práticas de segurança Supabase';