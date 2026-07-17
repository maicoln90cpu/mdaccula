-- O template "Sugestões Aleatórias - Cena Eletrônica" gerava artigos de opinião
-- sem nenhuma fonte real (ver docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md,
-- seção "Sugestões Aleatórias deveria ancorar em matéria real"). O fluxo de Sugestões
-- passou a usar generate-blog-post-from-topic (busca real via Firecrawl), então este
-- template fica sem uso. Desativado (não deletado) para preservar histórico.
UPDATE ai_prompt_templates
SET enabled = false
WHERE id = '7fe3924f-1420-4ec5-9305-8725afb7555f';
