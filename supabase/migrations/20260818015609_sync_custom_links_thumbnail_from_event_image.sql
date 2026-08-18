-- Mantém custom_links.thumbnail_url sempre igual a events.image_url
-- quando o link está vinculado a um evento (event_id preenchido).
-- Antes disso, a sincronização só acontecia em código de front-end (frágil,
-- falhava calada quando não achava nenhum link vinculado). Agora o gatilho
-- garante isso na base, não importa por qual caminho a imagem foi trocada.

CREATE OR REPLACE FUNCTION public.sync_custom_links_thumbnail()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.custom_links
  SET thumbnail_url = NEW.image_url,
      updated_at = now()
  WHERE event_id = NEW.id
    AND thumbnail_url IS DISTINCT FROM NEW.image_url;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_custom_links_thumbnail_trigger ON public.events;

CREATE TRIGGER sync_custom_links_thumbnail_trigger
AFTER UPDATE OF image_url ON public.events
FOR EACH ROW
WHEN (NEW.image_url IS DISTINCT FROM OLD.image_url)
EXECUTE FUNCTION public.sync_custom_links_thumbnail();

-- Correção retroativa: resincroniza tudo que já está divergente hoje.
UPDATE public.custom_links cl
SET thumbnail_url = e.image_url,
    updated_at = now()
FROM public.events e
WHERE cl.event_id = e.id
  AND cl.thumbnail_url IS DISTINCT FROM e.image_url;
