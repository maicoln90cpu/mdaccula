-- Adicionar coluna blog_post_id na tabela events para vincular eventos a posts do blog
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS blog_post_id uuid REFERENCES blog_posts(id);

COMMENT ON COLUMN events.blog_post_id IS 'Post do blog relacionado ao evento';