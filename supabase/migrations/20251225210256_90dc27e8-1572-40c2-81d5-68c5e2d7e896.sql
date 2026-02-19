-- Função para sincronizar display_order do link com a data do evento
CREATE OR REPLACE FUNCTION sync_link_order_with_event()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE custom_links
  SET display_order = EXTRACT(EPOCH FROM (NEW.date + NEW.time::time))::bigint,
      updated_at = NOW()
  WHERE event_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger que dispara quando a data ou hora do evento é alterada
DROP TRIGGER IF EXISTS on_event_date_change ON events;
CREATE TRIGGER on_event_date_change
AFTER UPDATE OF date, time ON events
FOR EACH ROW
EXECUTE FUNCTION sync_link_order_with_event();