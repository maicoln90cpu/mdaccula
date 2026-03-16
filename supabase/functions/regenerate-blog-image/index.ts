import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_IMAGE_PROMPT = `Crie uma imagem artística e profissional para um artigo sobre música eletrônica.

CONTEXTO DO ARTIGO:
- Título: "{{title}}"
- Resumo: {{summary}}
- Categoria: {{category}}
- Palavras-chave: {{keywords}}
- Atmosfera desejada: {{mood}}

INSTRUÇÕES DE GERAÇÃO:
1. Use as palavras-chave como referência visual principal
2. CAPTURE a atmosfera/mood indicada
3. A categoria deve influenciar o estilo visual

ESTILO: Fotorrealista com elementos artísticos, alta qualidade, cinematográfico.

EVITE: Imagens genéricas de boates, DJs de costas, multidões genéricas.

NÃO inclua texto, palavras ou números na imagem.`;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    // Buscar o post COM CONTEÚDO para extrair keywords
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

    // Função para extrair palavras-chave do conteúdo
    const extractKeywords = (content: string): string => {
      if (!content) return '';
      
      // Lista de stopwords em português
      const stopwords = new Set([
        'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'com', 'por',
        'que', 'uma', 'um', 'os', 'as', 'se', 'ou', 'mais', 'isso', 'esse', 'essa', 'este',
        'esta', 'como', 'sua', 'seu', 'seus', 'suas', 'ele', 'ela', 'eles', 'elas', 'foi',
        'são', 'tem', 'ter', 'será', 'sobre', 'entre', 'quando', 'muito', 'também', 'onde',
        'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'has', 'are', 'was'
      ]);
      
      const words = content.toLowerCase()
        .replace(/<[^>]*>/g, '') // Remove HTML
        .replace(/[^\w\sáéíóúâêîôûàèìòùãõç]/g, ' ') // Remove pontuação
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
    
    // Inferir mood baseado em palavras-chave do conteúdo
    const inferMood = (content: string, title: string): string => {
      const text = (content + ' ' + title).toLowerCase();
      
      if (text.includes('festival') || text.includes('celebra') || text.includes('festa')) return 'celebratório';
      if (text.includes('underground') || text.includes('techno') || text.includes('warehouse')) return 'underground';
      if (text.includes('futuro') || text.includes('tecnologia') || text.includes('ia') || text.includes('digital')) return 'futurista';
      if (text.includes('experimental') || text.includes('vanguarda') || text.includes('inovador')) return 'experimental';
      if (text.includes('clássico') || text.includes('história') || text.includes('vintage')) return 'nostálgico';
      if (text.includes('meditativo') || text.includes('ambient') || text.includes('chill')) return 'introspectivo';
      
      return 'energético'; // default para música eletrônica
    };

    const keywords = extractKeywords(post.content || '');
    const mood = inferMood(post.content || '', post.title);
    
    console.log(`🔑 Keywords extraídas: ${keywords}`);
    console.log(`🎭 Mood inferido: ${mood}`);

    // Buscar template de prompt de imagem do banco
    let imagePromptTemplate = DEFAULT_IMAGE_PROMPT;
    
    const { data: promptSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'ai_image_prompt_template')
      .single();

    if (promptSetting?.value) {
      imagePromptTemplate = promptSetting.value;
      console.log('✅ Usando template personalizado de prompt de imagem');
    } else {
      console.log('⚠️ Usando template padrão de prompt de imagem');
    }

    // Construir prompt da imagem com todas as variáveis
    const imagePrompt = imagePromptTemplate
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

    console.log(`🎨 Gerando imagem com prompt: ${imagePrompt.substring(0, 200)}...`);

    // Gerar imagem usando Nano Banana
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

    // Extrair imagem base64
    const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageBase64) {
      console.error('Sem imagem na resposta:', JSON.stringify(imageData).substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'Nenhuma imagem gerada pela IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Imagem base64 extraída com sucesso');

    // Converter base64 para WebP e fazer upload
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `blog-${postId}-${Date.now()}.webp`;
    
    console.log(`📤 Fazendo upload da imagem para Bunny: ${fileName}`);
    
    const BUNNY_STORAGE_API_KEY = Deno.env.get('BUNNY_STORAGE_API_KEY')?.trim();
    if (!BUNNY_STORAGE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'BUNNY_STORAGE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
    const bunnyUploadUrl = `https://${bunnyHostname}/mdacula/event-images/${fileName}`;
    const uploadResp = await fetch(bunnyUploadUrl, {
      method: 'PUT',
      headers: {
        AccessKey: BUNNY_STORAGE_API_KEY,
        'Content-Type': 'image/webp',
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

    const publicUrl = `https://mdacula.b-cdn.net/event-images/${fileName}`;
    console.log(`✅ URL pública: ${publicUrl}`);

    // Atualizar o post com a nova imagem
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
