import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= IMAGE STYLE PROMPTS =============
const IMAGE_STYLE_PROMPTS = [
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

async function pickRandomStyle(supabase: ReturnType<typeof createClient>): Promise<{ index: number; prompt: string }> {
  const { data: setting } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'last_image_style_index')
    .maybeSingle();

  const lastIndex = parseInt(setting?.value || '-1', 10);
  const availableIndices = IMAGE_STYLE_PROMPTS.map((_, i) => i).filter(i => i !== lastIndex);
  const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  
  await supabase
    .from('site_settings')
    .upsert(
      { key: 'last_image_style_index', value: String(nextIndex), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  console.log(`🎨 Estilo de imagem selecionado: ${nextIndex} (último: ${lastIndex})`);
  return { index: nextIndex, prompt: IMAGE_STYLE_PROMPTS[nextIndex] };
}
// ============= END IMAGE STYLE PROMPTS =============

const extractKeywords = (content: string): string => {
  if (!content) return '';
  const stopwords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'com', 'por',
    'que', 'uma', 'um', 'os', 'as', 'se', 'ou', 'mais', 'isso', 'esse', 'essa', 'este',
    'esta', 'como', 'sua', 'seu', 'seus', 'suas', 'ele', 'ela', 'eles', 'elas', 'foi',
    'são', 'tem', 'ter', 'será', 'sobre', 'entre', 'quando', 'muito', 'também', 'onde',
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'has', 'are', 'was'
  ]);
  const words = content.toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\sáéíóúâêîôûàèìòùãõç]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopwords.has(w));
  const freq: Record<string, number> = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w)
    .join(', ');
};

const inferMood = (content: string, title: string): string => {
  const text = (content + ' ' + title).toLowerCase();
  if (text.includes('festival') || text.includes('celebra') || text.includes('festa')) return 'celebratório';
  if (text.includes('underground') || text.includes('techno') || text.includes('warehouse')) return 'underground';
  if (text.includes('futuro') || text.includes('tecnologia') || text.includes('ia') || text.includes('digital')) return 'futurista';
  if (text.includes('experimental') || text.includes('vanguarda') || text.includes('inovador')) return 'experimental';
  if (text.includes('clássico') || text.includes('história') || text.includes('vintage')) return 'nostálgico';
  if (text.includes('meditativo') || text.includes('ambient') || text.includes('chill')) return 'introspectivo';
  return 'energético';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId } = await req.json();
    
    if (!postId) {
      return new Response(
        JSON.stringify({ error: 'postId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Supabase ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar o post
    console.log(`📝 Buscando post ${postId}...`);
    const { data: post, error: postError } = await supabase
      .from('blog_posts')
      .select('id, title, excerpt, category, content')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      console.error('Erro ao buscar post:', postError);
      return new Response(
        JSON.stringify({ error: 'Post não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📝 Post encontrado: ${post.title}`);

    const keywords = extractKeywords(post.content || '');
    const mood = inferMood(post.content || '', post.title);
    
    console.log(`🔑 Keywords extraídas: ${keywords}`);
    console.log(`🎭 Mood inferido: ${mood}`);

    // Verificar se há template customizado no banco
    const { data: promptSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'ai_image_prompt_template')
      .single();

    let imagePrompt: string;

    if (promptSetting?.value) {
      // Usar template customizado
      console.log('✅ Usando template personalizado de prompt de imagem');
      imagePrompt = promptSetting.value
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{title\}/g, post.title)
        .replace(/\{\{summary\}\}/g, post.excerpt || '')
        .replace(/\{summary\}/g, post.excerpt || '')
        .replace(/\{\{category\}\}/g, post.category || 'Música Eletrônica')
        .replace(/\{category\}/g, post.category || 'Música Eletrônica')
        .replace(/\{\{keywords\}\}/g, keywords)
        .replace(/\{keywords\}/g, keywords)
        .replace(/\{\{mood\}\}/g, mood)
        .replace(/\{mood\}/g, mood)
        .replace(/\{\{visualElements\}\}/g, '')
        .replace(/\{visualElements\}/g, '');
    } else {
      // Usar sistema de estilos variados
      const style = await pickRandomStyle(supabase);
      console.log(`🎨 Usando estilo variado #${style.index}`);
      imagePrompt = style.prompt
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{summary\}\}/g, post.excerpt || '')
        .replace(/\{\{category\}\}/g, post.category || 'Música Eletrônica')
        .replace(/\{\{keywords\}\}/g, keywords)
        .replace(/\{\{mood\}\}/g, mood)
        .replace(/\{\{visualElements\}\}/g, '');
    }

    console.log(`🎨 Gerando imagem com prompt: ${imagePrompt.substring(0, 200)}...`);

    // Gerar imagem
    const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: imagePrompt }],
        modalities: ['image', 'text']
      })
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error('Erro na API de imagem:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar imagem', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageData = await imageResponse.json();
    console.log('📸 Resposta da API de imagem recebida');

    const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageBase64) {
      console.error('Sem imagem na resposta:', JSON.stringify(imageData).substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'Nenhuma imagem gerada pela IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Imagem base64 extraída com sucesso');

    // Converter base64 para buffer e detectar formato real
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    let fileExt = 'png';
    let contentType = 'image/png';
    if (imageBytes.length > 12) {
      if (imageBytes[0] === 0x52 && imageBytes[1] === 0x49 && imageBytes[2] === 0x46 && imageBytes[3] === 0x46 &&
          imageBytes[8] === 0x57 && imageBytes[9] === 0x45 && imageBytes[10] === 0x42 && imageBytes[11] === 0x50) {
        fileExt = 'webp'; contentType = 'image/webp';
      } else if (imageBytes[0] === 0xFF && imageBytes[1] === 0xD8) {
        fileExt = 'jpg'; contentType = 'image/jpeg';
      }
    }
    
    const fileName = `blog-${postId}-${Date.now()}.${fileExt}`;
    
    console.log(`📤 Fazendo upload da imagem para Bunny: ${fileName} (${contentType})`);
    
    const BUNNY_STORAGE_API_KEY = Deno.env.get('BUNNY_STORAGE_API_KEY')?.trim()?.replace(/^["']|["']$/g, '')?.replace(/[^\x20-\x7E]/g, '');
    if (!BUNNY_STORAGE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'BUNNY_STORAGE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
    const bunnyUploadUrl = `https://${bunnyHostname}/mdaccula/event-images/${fileName}`;
    const uploadResp = await fetch(bunnyUploadUrl, {
      method: 'PUT',
      headers: {
        AccessKey: BUNNY_STORAGE_API_KEY,
        'Content-Type': contentType,
      },
      body: imageBytes,
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      console.error('Erro no upload Bunny:', errText);
      return new Response(
        JSON.stringify({ error: 'Erro ao fazer upload da imagem', details: errText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const publicUrl = `https://mdaccula.b-cdn.net/event-images/${fileName}`;
    console.log(`✅ URL pública: ${publicUrl}`);

    const { error: updateError } = await supabase
      .from('blog_posts')
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', postId);

    if (updateError) {
      console.error('Erro ao atualizar post:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar post', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Post atualizado com nova imagem!`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: publicUrl,
        message: 'Imagem regenerada com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
