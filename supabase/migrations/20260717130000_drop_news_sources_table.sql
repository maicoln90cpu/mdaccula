-- news_sources foi substituída por event_sources (unificação de fontes, 15/07/2026).
-- Confirmado: nenhum código lê/escreve nesta tabela, nenhuma FK a referencia.
-- Exclusão explicitamente confirmada pelo usuário em 17/07/2026.
drop table if exists public.news_sources;
