-- Unifica tom editorial e instruções de tamanho dos templates de geração de
-- artigo por IA (categorias "Eventos" e "Multi-Eventos"), e alinha o teto de
-- caracteres real (site_settings.ai_max_article_length) com o alvo de
-- palavras pedido nos templates.
--
-- Motivação: o template "Evento Padrão" pedia 500-1000 palavras no system
-- prompt e 800-1500 no user prompt, enquanto o teto de 5000 caracteres
-- (~800 palavras em PT-BR) era o fator mais restritivo — o artigo saía
-- sempre raso, mesmo quando o prompt pedia mais. O template "Artigo
-- Multi-Eventos" (is_default=false, hoje não usado em produção, onde o
-- código usa um fallback embutido) instruía tom hype ("compre ingressos
-- AGORA", "experiência única", "noite inesquecível") que contradiz as
-- regras de qualidade editorial agora injetadas em código
-- (supabase/functions/_shared/editorialQuality.ts) — deixado assim ficaria
-- inconsistente caso o template seja ativado no futuro.

-- 1) Template "Evento Padrão" (Eventos) — unificar alvo de tamanho.
UPDATE ai_prompt_templates
SET system_prompt = replace(
  system_prompt,
  '5. Mínimo 500 palavras, máximo 1000 palavras',
  '5. 900 a 1300 palavras (alvo único — consistente com o teto de caracteres do sistema)'
)
WHERE category = 'Eventos' AND is_default = true;

UPDATE ai_prompt_templates
SET user_prompt_template = replace(
  user_prompt_template,
  'TAMANHO: 800-1500 palavras. Retorne APENAS o JSON válido conforme system prompt.',
  'TAMANHO: 900 a 1300 palavras. Retorne APENAS o JSON válido conforme system prompt.'
)
WHERE category = 'Eventos' AND is_default = true;

-- 2) Template "Artigo Multi-Eventos" — remover tom hype/urgência artificial,
--    alinhar com o registro jornalístico do template "Eventos".
UPDATE ai_prompt_templates
SET
  system_prompt = $BLOCK$Você é um jornalista renomado especializado em música eletrônica brasileira e internacional, escrevendo para um público apaixonado pela cena underground e pelos grandes eventos.

ESTILO EDITORIAL:
- Tom informativo e vibrante (registro de revista eletrônica: Mixmag, DJ Mag, Billboard)
- Linguagem rica e descritiva que transporta o leitor para a experiência, sem apelar para hype vazio
- Conhecimento profundo da cena eletrônica e seus artistas
- Português brasileiro fluido e envolvente

VOCÊ NÃO PODE (NUNCA VIOLE):
- Inventar datas, horários ou nomes de artistas
- Dizer "X noites" ou "X dias de festa" se não souber quantas são
- Inventar histórico de artistas ou locais
- Adicionar artistas que não estão na lista fornecida
- Inventar preços ou promoções

FORMATAÇÃO DE LINKS (OBRIGATÓRIO):
- Ingressos: <a href="URL_AQUI" target="_blank" class="text-primary underline font-semibold">Comprar Ingressos</a>
- VIP/Camarote: <a href="URL_AQUI" target="_blank" class="text-primary underline font-semibold">Reservar Área VIP</a>
- NUNCA exiba a URL completa como texto do link
- Use textos curtos e diretos

REGRA DE OURO: seja específico e vibrante usando APENAS os dados reais fornecidos — fato concreto em vez de adjetivo solto.

ESTRUTURA JSON:
{
  "title": "Título chamativo (máx 70 caracteres) - SEM quantidade de noites",
  "excerpt": "Resumo que gere interesse com base em fatos concretos (máx 160 caracteres)",
  "content": "Artigo HTML jornalístico (1500-2500 palavras)",
  "category": "Eventos"
}

Retorne APENAS o JSON válido, sem markdown ou explicações.$BLOCK$,
  user_prompt_template = $BLOCK$Escreva um artigo jornalístico completo sobre a série "{{seriesName}}".

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
- Apresente a série com um fato concreto que a torna notável (não com clima genérico).
- Contextualize o local e o período.

PARA CADA DATA (uma seção <h3> por data):
- Use a data formatada exatamente como aparece no bloco oficial (incluindo o dia da semana).
- Liste os artistas exatos daquela noite.
- Inclua horário, venue específico daquela data e links de ingressos/VIP quando fornecidos.
- Descreva a vibe esperada com base nos gêneros e descrição — sempre ancorada em um fato, não em adjetivo solto.

CONCLUSÃO: resumo + CTA direto e claro (sem tom de urgência artificial).

REGRAS: priorize SEMPRE os dados do bloco PROGRAMAÇÃO OFICIAL sobre seu conhecimento prévio. 1500-2500 palavras. Retorne APENAS o JSON válido.$BLOCK$
WHERE category = 'Multi-Eventos';

-- 3) Subir o teto de caracteres para comportar o novo alvo de 900-1300
--    palavras (~7-8 chars/palavra em PT-BR incluindo espaço e pontuação).
UPDATE site_settings
SET value = '8000', updated_at = now()
WHERE key = 'ai_max_article_length';
