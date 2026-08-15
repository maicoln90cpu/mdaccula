-- R-062 — limpeza pontual: 7 eventos com claim "fantasma" em
-- events.email_campaign_dispatched_at (setado, mas sem nenhuma campanha real
-- criada na E-goi correspondente a ESSE claim específico — confirmado
-- manualmente pelo usuário no painel da E-goi em 15/08/2026). Ver R-062 em
-- docs/TESTING.md. Seguro: não apaga nem altera nenhuma linha de
-- event_email_campaigns; RoofTech/Krush/Solomun/Industria mantêm intacto o
-- histórico da campanha real anterior (todas enviadas com sucesso antes
-- desse claim fantasma). Music ON, One Life e Helvétia nunca tiveram
-- nenhuma campanha criada.
--
-- Conferido via SELECT antes de aplicar (execute_sql/MCP, 15/08/2026): bate
-- exatamente 7 linhas, nem mais nem menos.
DO $$
DECLARE
  affected_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO affected_ids
  FROM public.events
  WHERE email_campaign_dispatched_at IS NOT NULL
    AND (
      id IN ('08c5ea1e-29c6-4ae2-a95d-52f59a091975', 'bd060ecd-ce2d-4740-aa42-f737085a332d') -- Music ON, One Life
      OR title ILIKE '%RoofTech%'
      OR title ILIKE '%Krush%'
      OR title ILIKE '%SOLOMUN SP%'
      OR title ILIKE '%Industria apres. Blazy e Omiki%'
      OR title ILIKE '%Helvétia Open Bar%'
    );

  RAISE NOTICE 'Liberando claim fantasma de % evento(s): %', coalesce(array_length(affected_ids, 1), 0), affected_ids;

  UPDATE public.events
  SET email_campaign_dispatched_at = NULL
  WHERE id = ANY(affected_ids);
END $$;
