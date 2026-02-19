-- Corrigir required_fields de templates que estão como array para objeto
UPDATE ai_prompt_templates 
SET required_fields = '{"seriesName": true, "venue": true, "city": true, "state": true, "dates": true}'::jsonb
WHERE category = 'Multi-Eventos' AND jsonb_typeof(required_fields) = 'array';

UPDATE ai_prompt_templates 
SET required_fields = '{"title": true, "summary": true, "category": true}'::jsonb
WHERE name = 'Sugestões Aleatórias - Cena Eletrônica' AND jsonb_typeof(required_fields) = 'array';