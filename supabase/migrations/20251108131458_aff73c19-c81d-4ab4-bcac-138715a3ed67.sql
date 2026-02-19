-- FASE 1.1: Adicionar 8 novas fontes de notícias (verificar se já existem antes)
DO $$
BEGIN
  -- DJ Mag LA
  IF NOT EXISTS (SELECT 1 FROM news_sources WHERE url = 'https://djmagla.com/') THEN
    INSERT INTO news_sources (name, url, description, enabled) 
    VALUES ('DJ Mag LA', 'https://djmagla.com/', 'Notícias de música eletrônica da América Latina', true);
  END IF;
  
  -- Electronic Groove
  IF NOT EXISTS (SELECT 1 FROM news_sources WHERE url = 'https://electronicgroove.com/') THEN
    INSERT INTO news_sources (name, url, description, enabled) 
    VALUES ('Electronic Groove', 'https://electronicgroove.com/', 'Portal global de música eletrônica', true);
  END IF;
  
  -- Techno Airlines
  IF NOT EXISTS (SELECT 1 FROM news_sources WHERE url = 'https://www.technoairlines.com/') THEN
    INSERT INTO news_sources (name, url, description, enabled) 
    VALUES ('Techno Airlines', 'https://www.technoairlines.com/', 'Notícias especializadas em techno', true);
  END IF;
  
  -- Music Non Stop
  IF NOT EXISTS (SELECT 1 FROM news_sources WHERE url = 'https://musicnonstop.uol.com.br/') THEN
    INSERT INTO news_sources (name, url, description, enabled) 
    VALUES ('Music Non Stop', 'https://musicnonstop.uol.com.br/', 'Portal brasileiro de música eletrônica do UOL', true);
  END IF;
  
  -- Billboard Brasil
  IF NOT EXISTS (SELECT 1 FROM news_sources WHERE url = 'https://billboard.com.br/') THEN
    INSERT INTO news_sources (name, url, description, enabled) 
    VALUES ('Billboard Brasil', 'https://billboard.com.br/', 'Notícias da indústria musical brasileira', true);
  END IF;
  
  -- Tenho Mais Discos Que Amigos
  IF NOT EXISTS (SELECT 1 FROM news_sources WHERE url = 'https://www.tenhomaisdiscosqueamigos.com/') THEN
    INSERT INTO news_sources (name, url, description, enabled) 
    VALUES ('Tenho Mais Discos Que Amigos', 'https://www.tenhomaisdiscosqueamigos.com/', 'Blog cultural e musical brasileiro', true);
  END IF;
  
  -- Vish Mídia
  IF NOT EXISTS (SELECT 1 FROM news_sources WHERE url = 'https://www.vishmidia.com.br/') THEN
    INSERT INTO news_sources (name, url, description, enabled) 
    VALUES ('Vish Mídia', 'https://www.vishmidia.com.br/', 'Plataforma de cultura pop e música', true);
  END IF;
  
  -- GRVE
  IF NOT EXISTS (SELECT 1 FROM news_sources WHERE url = 'https://grve.com.br/') THEN
    INSERT INTO news_sources (name, url, description, enabled) 
    VALUES ('GRVE', 'https://grve.com.br/', 'Portal de música eletrônica brasileira', true);
  END IF;
END $$;

-- FASE 2.1: Criar função de busca otimizada
CREATE OR REPLACE FUNCTION search_blog_posts(
  search_query text,
  category_filter text DEFAULT NULL,
  limit_results int DEFAULT 10,
  offset_results int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  excerpt text,
  slug text,
  category text,
  image_url text,
  published_at timestamptz,
  rank real,
  headline text
) AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- FASE 3.2: Criar tabela de analytics de compartilhamento
CREATE TABLE IF NOT EXISTS share_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  shared_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT,
  referrer TEXT
);

CREATE INDEX IF NOT EXISTS idx_share_analytics_url ON share_analytics(url);
CREATE INDEX IF NOT EXISTS idx_share_analytics_platform ON share_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_share_analytics_shared_at ON share_analytics(shared_at);

-- FASE 4.1: Adicionar coluna views em events e criar funções de incremento
ALTER TABLE events ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_post_views(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts 
  SET views = views + 1 
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_event_views(event_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE events 
  SET views = COALESCE(views, 0) + 1 
  WHERE id = event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;