-- Fix search_path for all functions without it set

-- 1. generate_link_group_slug
CREATE OR REPLACE FUNCTION public.generate_link_group_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

-- 2. generate_slug
CREATE OR REPLACE FUNCTION public.generate_slug(text_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  slug_output text;
BEGIN
  -- Converte para minúsculas e remove acentos
  slug_output := lower(translate(
    text_input,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  ));
  -- Substitui espaços e caracteres especiais por hífens
  slug_output := regexp_replace(slug_output, '[^a-z0-9]+', '-', 'g');
  -- Remove hífens no início e fim
  slug_output := trim(both '-' from slug_output);
  RETURN slug_output;
END;
$function$;

-- 3. set_event_slug
CREATE OR REPLACE FUNCTION public.set_event_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title) || '-' || substring(NEW.id::text from 1 for 8);
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. set_post_slug
CREATE OR REPLACE FUNCTION public.set_post_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title) || '-' || substring(NEW.id::text from 1 for 8);
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. search_blog_posts
CREATE OR REPLACE FUNCTION public.search_blog_posts(search_query text, category_filter text DEFAULT NULL::text, limit_results integer DEFAULT 10, offset_results integer DEFAULT 0)
RETURNS TABLE(id uuid, title text, excerpt text, slug text, category text, image_url text, published_at timestamp with time zone, rank real, headline text)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.excerpt,
    bp.slug,
    bp.category,
    bp.image_url,
    bp.published_at,
    ts_rank(bp.search_vector, websearch_to_tsquery('portuguese', search_query)) as rank,
    ts_headline('portuguese', bp.content, websearch_to_tsquery('portuguese', search_query), 
      'MaxWords=50, MinWords=20, ShortWord=3') as headline
  FROM blog_posts bp
  WHERE 
    bp.published = true
    AND bp.search_vector @@ websearch_to_tsquery('portuguese', search_query)
    AND (category_filter IS NULL OR bp.category = category_filter)
  ORDER BY rank DESC, bp.published_at DESC
  LIMIT limit_results
  OFFSET offset_results;
END;
$function$;