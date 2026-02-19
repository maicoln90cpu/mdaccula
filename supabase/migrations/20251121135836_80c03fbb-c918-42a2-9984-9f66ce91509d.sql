-- Adicionar novos campos em event_templates
ALTER TABLE event_templates 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS subtitle text,
ADD COLUMN IF NOT EXISTS time time without time zone,
ADD COLUMN IF NOT EXISTS description text;

-- Adicionar coluna slug em link_groups
ALTER TABLE link_groups 
ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Função para gerar slug de grupo
CREATE OR REPLACE FUNCTION public.generate_link_group_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.name);
    
    -- Garantir que o slug seja único adicionando sufixo se necessário
    IF EXISTS (SELECT 1 FROM link_groups WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')) THEN
      NEW.slug := NEW.slug || '-' || substring(NEW.id::text from 1 for 8);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger para gerar slug automaticamente
DROP TRIGGER IF EXISTS set_link_group_slug ON link_groups;
CREATE TRIGGER set_link_group_slug
BEFORE INSERT OR UPDATE ON link_groups
FOR EACH ROW
EXECUTE FUNCTION public.generate_link_group_slug();

-- Popular slugs para grupos existentes
UPDATE link_groups 
SET slug = generate_slug(name) || '-' || substring(id::text from 1 for 8)
WHERE slug IS NULL;