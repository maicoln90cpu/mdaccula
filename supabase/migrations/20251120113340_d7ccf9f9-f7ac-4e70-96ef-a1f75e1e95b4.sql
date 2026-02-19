-- Atualizar template de Sugestões Aleatórias para retornar JSON estruturado
UPDATE public.ai_prompt_templates
SET 
  user_prompt_template = 'Com base no título "{title}" e tema "{summary}", crie um artigo completo e detalhado sobre {category} na cena eletrônica.

IMPORTANTE: Retorne APENAS um objeto JSON válido (sem markdown, sem código, apenas JSON puro) com esta estrutura:
{
  "title": "título do artigo (baseado em: {title})",
  "excerpt": "resumo de 1-2 frases do artigo",
  "content": "conteúdo HTML do artigo completo com 800-1200 palavras",
  "category": "{category}"
}

O conteúdo HTML deve incluir:
- Introdução cativante com <p>
- 3-4 seções com <h3> e <p>
- Contexto histórico quando relevante
- Menção a artistas, eventos ou tecnologias com <strong>
- Conclusão com perspectivas futuras
- Use tags HTML apropriadas: <p>, <h3>, <strong>, <em>, <ul>, <li>

Escreva de forma jornalística, com informações verificáveis e linguagem clara. Retorne APENAS o JSON, sem texto adicional.'
WHERE name = 'Sugestões Aleatórias - Cena Eletrônica';