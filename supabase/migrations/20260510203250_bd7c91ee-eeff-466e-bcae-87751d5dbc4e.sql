
UPDATE public.ai_prompt_templates
SET user_prompt_template = $TPL$Escreva um artigo jornalístico COMPLETO sobre o evento listado no bloco "DADOS OFICIAIS DO EVENTO" acima.

INSTRUÇÕES EDITORIAIS:

TÍTULO (h1 implícito no campo title do JSON):
- Chamativo, SEO-friendly, máx 70 caracteres.
- Use o nome real do evento + venue + cidade + data quando couber.

INTRODUÇÃO (2-3 parágrafos):
- Apresente o evento com energia, contextualizando a vibe.
- Cite o dia da semana exato fornecido em DADOS OFICIAIS.
- Mencione o subtítulo/promoção se existir.

CORPO:
- Seção <h2> "Lineup" listando os artistas exatos do bloco oficial (sem inventar).
- Seção <h2> "Local e horário" com venue, endereço, cidade/estado, horário de início e término (se fornecidos).
- Seção <h2> "Por que ir" com vibe esperada baseada nos gêneros e descrição oficial.
- Use <strong> para destaques, <a href> para links de ingressos/VIP fornecidos.

CONCLUSÃO:
- Call-to-action curto. Se houver link de ingressos real, oriente a compra.

TAMANHO: 800-1500 palavras. Retorne APENAS o JSON válido conforme system prompt.$TPL$
WHERE name = 'Evento Padrão';

UPDATE public.ai_prompt_templates
SET user_prompt_template = $TPL$Escreva uma cobertura COMPLETA do festival listado no bloco "DADOS OFICIAIS DO EVENTO" acima.

INSTRUÇÕES EDITORIAIS:

TÍTULO: chamativo, com nome do festival + cidade/data.

INTRODUÇÃO (3-4 parágrafos):
- Posicione o festival na cena (relevância, edição, contexto sazonal).
- Cite o local oficial (venue + cidade) e o dia da semana correto.

CORPO (use <h2>/<h3>):
- "Lineup": liste os artistas exatos do bloco oficial.
- "Estrutura e palcos": descreva com base nos dados oficiais e descrição.
- "Ingressos e informações práticas": apenas com dados fornecidos. Se houver link real, inclua-o.
- "Como chegar / endereço": use o endereço oficial.

CONCLUSÃO: resumo + CTA.

REGRAS: NUNCA invente lineup, palcos, horários ou links. 1500-2500 palavras. Retorne APENAS o JSON válido.$TPL$
WHERE name = 'Cobertura Festival';

UPDATE public.ai_prompt_templates
SET user_prompt_template = $TPL$Escreva um artigo EMPOLGANTE sobre a série "{{seriesName}}".

DADOS GERAIS DA SÉRIE:
- Local comum: {{venue}}, {{city}} - {{state}}
- Período: {{startDate}} a {{endDate}}
- Gêneros: {{genres}}

PROGRAMAÇÃO OFICIAL (use literalmente, NUNCA invente):
{{dates}}

{{additionalContext}}

INSTRUÇÕES EDITORIAIS:

TÍTULO: chamativo, SEO-friendly, sem citar quantidade de noites.

INTRODUÇÃO (2-3 parágrafos):
- Apresente a série com energia.
- Contextualize o local e o período.

PARA CADA DATA (uma seção <h3> por data):
- Use a data formatada exatamente como aparece no bloco oficial (incluindo o dia da semana).
- Liste os artistas exatos daquela noite.
- Inclua horário, venue específico daquela data e links de ingressos/VIP quando fornecidos.
- Descreva a vibe esperada com base nos gêneros e descrição.

CONCLUSÃO: resumo + CTA forte.

REGRAS: priorize SEMPRE os dados do bloco PROGRAMAÇÃO OFICIAL sobre seu conhecimento prévio. 1500-2500 palavras. Retorne APENAS o JSON válido.$TPL$
WHERE name = 'Artigo Multi-Eventos';
