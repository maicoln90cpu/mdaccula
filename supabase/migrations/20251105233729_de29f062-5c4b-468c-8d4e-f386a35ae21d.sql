-- Fase 4: Correção e Otimização do Banco de Dados

-- 1. Adicionar Foreign Key para created_by (author_id já existe)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'events_created_by_fkey'
  ) THEN
    ALTER TABLE public.events
    ADD CONSTRAINT events_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Corrigir tipos de dados em events (date e time)
-- Verificar se as colunas antigas ainda existem
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'date' AND data_type = 'text'
  ) THEN
    -- Adicionar novas colunas com tipos corretos
    ALTER TABLE public.events ADD COLUMN event_date DATE;
    ALTER TABLE public.events ADD COLUMN event_time TIME;
    
    -- Migrar dados existentes
    UPDATE public.events
    SET 
      event_date = CASE 
        WHEN date ~ '^\d{4}-\d{2}-\d{2}' THEN date::DATE
        ELSE NULL
      END,
      event_time = CASE
        WHEN time ~ '^\d{2}:\d{2}' THEN time::TIME
        ELSE NULL
      END;
    
    -- Remover colunas antigas
    ALTER TABLE public.events DROP COLUMN date;
    ALTER TABLE public.events DROP COLUMN time;
    
    -- Renomear novas colunas
    ALTER TABLE public.events RENAME COLUMN event_date TO date;
    ALTER TABLE public.events RENAME COLUMN event_time TO time;
    
    -- Tornar obrigatórias
    ALTER TABLE public.events ALTER COLUMN date SET NOT NULL;
    ALTER TABLE public.events ALTER COLUMN time SET NOT NULL;
  END IF;
END $$;

-- 3. Ajustar campos nullable
ALTER TABLE public.blog_posts 
ALTER COLUMN published SET DEFAULT false,
ALTER COLUMN published SET NOT NULL;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'slug' AND is_nullable = 'YES'
  ) THEN
    -- Primeiro garantir que todos os slugs existentes não são nulos
    UPDATE public.events SET slug = 'event-' || id::text WHERE slug IS NULL;
    ALTER TABLE public.events ALTER COLUMN slug SET NOT NULL;
  END IF;
END $$;

-- 4. Adicionar índices de performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON public.blog_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_genre ON public.events(genre);
CREATE INDEX IF NOT EXISTS idx_events_location_state ON public.events(location_state);
CREATE INDEX IF NOT EXISTS idx_events_location_city ON public.events(location_city);