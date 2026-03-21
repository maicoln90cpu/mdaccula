-- Fix redirect_links with missing protocol or arrow prefix
UPDATE redirect_links 
SET destination_url = regexp_replace(destination_url, '^→\s*', '')
WHERE destination_url LIKE '→%';

UPDATE redirect_links 
SET destination_url = 'https://' || destination_url
WHERE destination_url NOT LIKE 'http://%' 
  AND destination_url NOT LIKE 'https://%';
