-- Corrigir search_path das funções para segurança
CREATE OR REPLACE FUNCTION public.update_blog_posts_search_vector()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$;