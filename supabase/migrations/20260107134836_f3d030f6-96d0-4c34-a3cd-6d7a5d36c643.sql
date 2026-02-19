-- =====================================================
-- AUDITORIA E CORREÇÃO DE SLUGS - MDAccula
-- =====================================================

-- 1. Adicionar constraints UNIQUE nas colunas slug
-- (usando DROP IF EXISTS para evitar erros se já existirem)

ALTER TABLE blog_posts 
DROP CONSTRAINT IF EXISTS blog_posts_slug_unique;

ALTER TABLE blog_posts 
ADD CONSTRAINT blog_posts_slug_unique UNIQUE (slug);

ALTER TABLE events 
DROP CONSTRAINT IF EXISTS events_slug_unique;

ALTER TABLE events 
ADD CONSTRAINT events_slug_unique UNIQUE (slug);

ALTER TABLE link_groups 
DROP CONSTRAINT IF EXISTS link_groups_slug_unique;

ALTER TABLE link_groups 
ADD CONSTRAINT link_groups_slug_unique UNIQUE (slug);

-- 2. Criar função de validação de slug
CREATE OR REPLACE FUNCTION public.validate_slug(input_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Slug deve ter pelo menos 1 caractere
  -- Apenas letras minúsculas, números e hífens
  -- Não pode começar ou terminar com hífen
  -- Permite slugs curtos (mínimo 1 char) para flexibilidade
  IF input_slug IS NULL OR input_slug = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Validar formato: apenas a-z, 0-9 e hífens, sem hífen no início/fim
  RETURN input_slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$';
END;
$$;

-- 3. Criar função trigger para validar slugs antes de inserir/atualizar
CREATE OR REPLACE FUNCTION public.check_slug_validity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Se slug for NULL ou vazio, deixar o trigger existente gerar
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    RETURN NEW;
  END IF;
  
  -- Validar formato do slug
  IF NOT validate_slug(NEW.slug) THEN
    RAISE EXCEPTION 'Slug inválido: %. Use apenas letras minúsculas, números e hífens.', NEW.slug;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Remover triggers existentes se houver
DROP TRIGGER IF EXISTS validate_blog_post_slug ON blog_posts;
DROP TRIGGER IF EXISTS validate_event_slug ON events;
DROP TRIGGER IF EXISTS validate_link_group_slug ON link_groups;

-- 5. Criar triggers de validação em todas as tabelas
CREATE TRIGGER validate_blog_post_slug
BEFORE INSERT OR UPDATE ON blog_posts
FOR EACH ROW EXECUTE FUNCTION check_slug_validity();

CREATE TRIGGER validate_event_slug
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION check_slug_validity();

CREATE TRIGGER validate_link_group_slug
BEFORE INSERT OR UPDATE ON link_groups
FOR EACH ROW EXECUTE FUNCTION check_slug_validity();