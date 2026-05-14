-- Adiciona custom_links e link_groups à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.link_groups;

-- REPLICA IDENTITY FULL permite que o realtime envie o conteúdo completo da linha em UPDATEs/DELETEs
ALTER TABLE public.custom_links REPLICA IDENTITY FULL;
ALTER TABLE public.link_groups REPLICA IDENTITY FULL;