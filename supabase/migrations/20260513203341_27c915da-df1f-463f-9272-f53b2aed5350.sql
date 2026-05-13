
-- 1) Normaliza lineup do STB: split na vírgula, trim, remove ponto final, remove vazios
WITH split_artists AS (
  SELECT
    e.id,
    array_agg(trim(both ' .' FROM artist) ORDER BY ord) AS clean_lineup
  FROM events e,
       LATERAL unnest(e.lineup) WITH ORDINALITY AS u(item, ord),
       LATERAL regexp_split_to_table(u.item, '\s*,\s*') AS artist
  WHERE e.id = '64142369-229a-48cf-a5eb-8f1d0f7307d0'
    AND length(trim(artist)) > 0
  GROUP BY e.id
)
UPDATE events e
SET lineup = sa.clean_lineup,
    updated_at = now()
FROM split_artists sa
WHERE e.id = sa.id;

-- 2) Constrói schedule com 2 dias (05 e 06/06) usando o lineup já corrigido
UPDATE events
SET schedule = jsonb_build_array(
      jsonb_build_object(
        'date', '2026-06-05',
        'time', COALESCE(time::text, '15:00:00'),
        'end_time', NULL,
        'lineup', to_jsonb(lineup)
      ),
      jsonb_build_object(
        'date', '2026-06-06',
        'time', COALESCE(time::text, '15:00:00'),
        'end_time', NULL,
        'lineup', to_jsonb(lineup)
      )
    ),
    updated_at = now()
WHERE id = '64142369-229a-48cf-a5eb-8f1d0f7307d0';
