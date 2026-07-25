import type { createClient } from "npm:@supabase/supabase-js@2";

export const IMAGE_STYLE_PROMPTS = [
  // Estilo 0: Fotorrealista cinematográfico
  `Crie uma imagem FOTORREALISTA e CINEMATOGRÁFICA para um artigo sobre música eletrônica.

CONTEXTO: "{{title}}" — {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGATÓRIO: Fotorrealismo cinematográfico
- Profundidade de campo rasa (bokeh)
- Iluminação dramática com contraste forte (chiaroscuro)
- Tons quentes e frios em equilíbrio
- Composição em regra dos terços
- Aspecto de fotografia editorial de alta moda ou concert photography
- Referências visuais: Annie Leibovitz, Tim Walker

EVITE: imagens genéricas de boates, DJs de costas, multidões genéricas.
NÃO inclua texto, palavras ou números na imagem.`,

  // Estilo 1: Neon/Cyberpunk
  `Crie uma imagem com estética NEON CYBERPUNK para um artigo sobre música eletrônica.

CONTEXTO: "{{title}}" — {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGATÓRIO: Arte digital neon/cyberpunk
- Cores neon vibrantes: magenta, ciano, roxo elétrico, verde neon
- Gradientes intensos e brilho luminoso (glow effects)
- Estética futurista urbana, luzes de LED, reflexos em superfícies molhadas
- Atmosfera noturna com neblina colorida
- Referências visuais: Blade Runner, Tron, arte de Beeple
- Composição dinâmica com linhas de luz

EVITE: imagens flat ou sem profundidade, cenas diurnas.
NÃO inclua texto, palavras ou números na imagem.`,

  // Estilo 2: Ilustração artística / pintura digital
  `Crie uma ILUSTRAÇÃO ARTÍSTICA estilo pintura digital para um artigo sobre música eletrônica.

CONTEXTO: "{{title}}" — {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGATÓRIO: Pintura digital / ilustração artística
- Texturas pictóricas visíveis (como pintura a óleo ou aquarela digital)
- Paleta de cores expressiva e ousada
- Pinceladas visíveis que dão energia e movimento
- Mistura de realismo com elementos abstratos
- Referências visuais: concept art, arte de álbum, ilustração editorial
- Composição expressionista com foco emocional

EVITE: fotorrealismo, renderização 3D limpa, imagens flat.
NÃO inclua texto, palavras ou números na imagem.`,

  // Estilo 3: Minimalista abstrato
  `Crie uma imagem MINIMALISTA e ABSTRATA para um artigo sobre música eletrônica.

CONTEXTO: "{{title}}" — {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGATÓRIO: Minimalismo abstrato
- Formas geométricas limpas e precisas
- Paleta de cores reduzida (máximo 3-4 cores)
- Muito espaço negativo e respiração visual
- Gradientes suaves e transições elegantes
- Referências visuais: arte de capa da Kompakt, Raster-Noton, design suíço
- Composição equilibrada e sofisticada

EVITE: excesso de detalhes, fotorrealismo, poluição visual.
NÃO inclua texto, palavras ou números na imagem.`,

  // Estilo 4: Colagem editorial / mixed media
  `Crie uma imagem estilo COLAGEM EDITORIAL / MIXED MEDIA para um artigo sobre música eletrônica.

CONTEXTO: "{{title}}" — {{summary}}
Categoria: {{category}} | Keywords: {{keywords}} | Mood: {{mood}}

ESTILO OBRIGATÓRIO: Colagem editorial e mixed media
- Sobreposição de camadas e texturas diferentes
- Mistura de fotografia com elementos gráficos e tipográficos
- Estética de revista, zine ou poster de evento underground
- Texturas de papel rasgado, grunge, halftone, risograph
- Referências visuais: David Carson, Neville Brody, posters de rave dos anos 90
- Composição desconstruída e energética

EVITE: imagens limpas demais, fotorrealismo puro, simetria perfeita.
NÃO inclua texto, palavras ou números na imagem.`
];

// Função para selecionar estilo aleatório sem repetir o último
async function pickRandomStyle(supabase: ReturnType<typeof createClient>): Promise<{ index: number; prompt: string }> {
  // Buscar último estilo usado
  const { data: setting } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'last_image_style_index')
    .maybeSingle();

  const lastIndex = parseInt(setting?.value || '-1', 10);
  
  // Filtrar o último índice e sortear entre os restantes
  const availableIndices = IMAGE_STYLE_PROMPTS.map((_, i) => i).filter(i => i !== lastIndex);
  const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  
  // Salvar novo índice (upsert)
  await supabase
    .from('site_settings')
    .upsert(
      { key: 'last_image_style_index', value: String(nextIndex), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  console.log(`🎨 Estilo de imagem selecionado: ${nextIndex} (último: ${lastIndex})`);
  
  return { index: nextIndex, prompt: IMAGE_STYLE_PROMPTS[nextIndex] };
