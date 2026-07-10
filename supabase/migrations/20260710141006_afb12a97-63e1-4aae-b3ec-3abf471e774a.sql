-- Troca variantes de "Cuiabá"/"CUIABÁ"/"Cuiaba" dentro dos blocos JSON dos templates de e-mail.
UPDATE public.email_templates
SET blocks = REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(blocks::text, 'CUIABÁ', 'SÃO PAULO'),
                  'Cuiabá', 'São Paulo'
                ),
                'Cuiaba', 'São Paulo'
              ),
              'cuiabá', 'São Paulo'
            )::jsonb
WHERE blocks::text ILIKE '%cuiab%';

-- Idem no footer_text global (defensivo — hoje já está "São Paulo - SP").
UPDATE public.email_template_settings
SET footer_text = REPLACE(REPLACE(footer_text, 'Cuiabá-MT', 'São Paulo - SP'), 'Cuiabá', 'São Paulo')
WHERE footer_text ILIKE '%cuiab%';