
-- 1) Backfill do array lineup nos eventos ativos
WITH active AS (
  SELECT id FROM events WHERE (date >= CURRENT_DATE OR end_date >= CURRENT_DATE)
),
split AS (
  SELECT
    e.id,
    array_agg(trim(both ' .' FROM artist) ORDER BY ord, sub_ord) AS clean_lineup
  FROM events e
  JOIN active a ON a.id = e.id,
       LATERAL unnest(e.lineup) WITH ORDINALITY AS u(item, ord),
       LATERAL regexp_split_to_table(u.item, '\s*[,;]\s*') WITH ORDINALITY AS s(artist, sub_ord)
  WHERE length(trim(both ' .' FROM artist)) > 0
  GROUP BY e.id
)
UPDATE events e
SET lineup = sp.clean_lineup,
    updated_at = now()
FROM split sp
WHERE e.id = sp.id
  AND sp.clean_lineup IS DISTINCT FROM e.lineup;

-- 2) Backfill do lineup dentro de cada entrada do schedule (festivais ativos)
WITH active_with_sched AS (
  SELECT id, schedule
  FROM events
  WHERE (date >= CURRENT_DATE OR end_date >= CURRENT_DATE)
    AND schedule IS NOT NULL
    AND jsonb_typeof(schedule) = 'array'
),
exploded AS (
  SELECT
    aws.id,
    entry_idx,
    entry,
    COALESCE(
      (
        SELECT jsonb_agg(trim(both ' .' FROM artist) ORDER BY l_ord, s_ord)
        FROM jsonb_array_elements_text(COALESCE(entry->'lineup', '[]'::jsonb)) WITH ORDINALITY AS l(item, l_ord),
             LATERAL regexp_split_to_table(l.item, '\s*[,;]\s*') WITH ORDINALITY AS s(artist, s_ord)
        WHERE length(trim(both ' .' FROM artist)) > 0
      ),
      '[]'::jsonb
    ) AS clean_lineup
  FROM active_with_sched aws,
       LATERAL jsonb_array_elements(aws.schedule) WITH ORDINALITY AS x(entry, entry_idx)
),
rebuilt AS (
  SELECT
    id,
    jsonb_agg(jsonb_set(entry, '{lineup}', clean_lineup) ORDER BY entry_idx) AS new_schedule
  FROM exploded
  GROUP BY id
)
UPDATE events e
SET schedule = r.new_schedule,
    updated_at = now()
FROM rebuilt r
WHERE e.id = r.id
  AND r.new_schedule IS DISTINCT FROM e.schedule;
