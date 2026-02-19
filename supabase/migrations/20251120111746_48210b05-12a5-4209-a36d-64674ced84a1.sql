-- Criar template para geração de sugestões aleatórias de artigos
INSERT INTO public.ai_prompt_templates (
  name,
  description,
  category,
  system_prompt,
  user_prompt_template,
  required_fields,
  enabled,
  is_default
) VALUES (
  'Sugestões Aleatórias - Cena Eletrônica',
  'Gera 5 sugestões de artigos sobre novidades da cena eletrônica baseadas nas fontes configuradas',
  'Sugestões',
  'Você é um especialista em música eletrônica e cultura de clubes. Crie artigos envolventes, informativos e atuais sobre a cena eletrônica brasileira e internacional. Use um tom profissional mas acessível.',
  'Com base no título "{title}" e tema "{summary}", crie um artigo completo e detalhado sobre {category} na cena eletrônica. O artigo deve:

1. Ter entre 800-1200 palavras
2. Incluir introdução cativante
3. Desenvolver o tema em 3-4 seções
4. Adicionar contexto histórico quando relevante
5. Mencionar artistas, eventos ou tecnologias relacionadas
6. Concluir com perspectivas futuras

Escreva de forma jornalística, com informações verificáveis e linguagem clara.',
  '["title", "summary", "category"]'::jsonb,
  true,
  false
);