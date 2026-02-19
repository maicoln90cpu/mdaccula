-- Adicionar campo event_id na tabela custom_links para vincular links a eventos
ALTER TABLE public.custom_links 
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;