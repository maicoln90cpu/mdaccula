-- Adicionar coluna link_group_id na tabela recurring_event_configs
ALTER TABLE public.recurring_event_configs 
ADD COLUMN link_group_id uuid REFERENCES public.link_groups(id);

-- Comentário explicativo
COMMENT ON COLUMN public.recurring_event_configs.link_group_id IS 'ID do grupo de links onde os links dos eventos recorrentes serão criados automaticamente';