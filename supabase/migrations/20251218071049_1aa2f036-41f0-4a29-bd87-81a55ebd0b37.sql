-- FASE 2: Adicionar ON DELETE SET NULL na FK events_blog_post_id
-- Isso permite deletar posts mesmo com eventos vinculados

-- Remover constraint existente
ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_blog_post_id_fkey;

-- Recriar com ON DELETE SET NULL
ALTER TABLE public.events
ADD CONSTRAINT events_blog_post_id_fkey 
FOREIGN KEY (blog_post_id) 
REFERENCES public.blog_posts(id) 
ON DELETE SET NULL;