-- Backfill override_date and override_time for existing event-linked custom_links
UPDATE custom_links cl
SET override_date = e.date, override_time = e.time
FROM events e
WHERE cl.event_id = e.id
AND (cl.override_date IS NULL OR cl.override_time IS NULL);