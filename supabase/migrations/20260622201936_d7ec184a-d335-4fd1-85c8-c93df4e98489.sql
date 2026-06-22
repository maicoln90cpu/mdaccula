UPDATE public.events
SET ticket_link = 'https://' || ticket_link
WHERE ticket_link IS NOT NULL
  AND ticket_link <> ''
  AND ticket_link !~* '^(https?://|mailto:|tel:|sms:)';

UPDATE public.events
SET vip_link = 'https://' || vip_link
WHERE vip_link IS NOT NULL
  AND vip_link <> ''
  AND vip_link !~* '^(https?://|mailto:|tel:|sms:)';

UPDATE public.custom_links
SET url = 'https://' || url
WHERE url IS NOT NULL
  AND url <> ''
  AND url !~* '^(https?://|mailto:|tel:|sms:|/|#)';