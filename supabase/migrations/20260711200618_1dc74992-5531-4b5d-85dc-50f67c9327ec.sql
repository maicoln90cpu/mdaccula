UPDATE public.email_templates
SET
  subject_template = replace(subject_template, 'Cuiabá', 'São Paulo'),
  preheader_template = replace(preheader_template, 'Cuiabá', 'São Paulo'),
  updated_at = now()
WHERE subject_template ILIKE '%Cuiabá%'
   OR preheader_template ILIKE '%Cuiabá%';