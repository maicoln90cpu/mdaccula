// Persistência do post (slug único, insert/update, log de IA) extraída de
// generate-blog-post-v2/index.ts (Onda 22). Comportamento preservado 1:1.
import { isContentSubstantial } from '../articleQuality.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

export async function generateUniqueSlug(supabase: Supabase, title: string): Promise<string> {
  const baseSlug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  let slug = baseSlug;
  let slugExists = true;
  let attempts = 0;

  while (slugExists && attempts < 5) {
    const { data: existingPost } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingPost) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
      attempts++;
    } else {
      slugExists = false;
    }
  }
  return slug;
}

export interface SavePostParams {
  existingPostId?: string | null;
  publishImmediately?: boolean;
  eventData: { title: string; excerpt?: string; content: string };
  finalCategory: string;
  generatedImageUrl: string | null;
  slug: string;
}

export async function saveOrUpdatePost(supabase: Supabase, params: SavePostParams) {
  const {
    existingPostId,
    publishImmediately,
    eventData,
    finalCategory,
    generatedImageUrl,
    slug,
  } = params;

  if (existingPostId) {
    console.log('[generate-blog-post-v2] Atualizando post existente:', existingPostId);
    const { data, error } = await supabase
      .from('blog_posts')
      .update({
        title: eventData.title,
        excerpt: eventData.excerpt,
        content: eventData.content,
        category: finalCategory,
        ...(generatedImageUrl && { image_url: generatedImageUrl }),
      })
      .eq('id', existingPostId)
      .select()
      .single();
    return { post: data, error };
  }

  // Item #2 (reorganização dos controles de publicação, 10/08/2026): rede de
  // segurança extra bem no fim, antes de decidir published — generate-blog-post-v2
  // nunca teve nenhuma checagem de tamanho/qualidade (diferente de
  // generate-blog-post-from-topic, que já rejeita conteúdo curto antes de
  // chegar aqui). Mesmo com o toggle de publicação automática ligado, um
  // artigo raso nunca vai ao ar sozinho — cai como rascunho pra revisão.
  const substantial = isContentSubstantial(eventData.content);
  const willPublish = publishImmediately !== false && substantial;

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      title: eventData.title,
      slug,
      excerpt: eventData.excerpt,
      content: eventData.content,
      category: finalCategory,
      published: willPublish,
      published_at: willPublish ? new Date().toISOString() : null,
      image_url: generatedImageUrl,
    })
    .select()
    .single();
  return { post: data, error, downgradedForQuality: publishImmediately !== false && !substantial };
}

export interface LogAiGenerationParams {
  postId: string;
  templateName: string;
  templateId: string;
  // Item #7/#9 (reorganização dos controles de publicação): qual dos 8
  // caminhos de geração disparou essa chamada — gerar_tab | sugestoes_template
  // | por_evento | event_watcher (os únicos 4 que passam por esta function
  // compartilhada). null = chamador não informou (nunca deve acontecer nos
  // caminhos já migrados, mas não quebra se acontecer).
  generationSource: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formFields: Record<string, any>;
  selectedModel: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  usage: any;
  imageTokensUsed: number;
  guardrailSourceUrls: string[] | null;
}

export async function logAiGeneration(supabase: Supabase, params: LogAiGenerationParams) {
  const promptFieldsSummary = Object.entries(params.formFields)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${String(value).substring(0, 50)}`)
    .join(' | ');

  const { error: aiLogError } = await supabase.from('ai_generated_posts').insert({
    blog_post_id: params.postId,
    prompt_used: `Template: ${params.templateName} | ${promptFieldsSummary}`,
    model_used: params.selectedModel,
    template_id: params.templateId,
    input_tokens: params.usage?.prompt_tokens || null,
    output_tokens: params.usage?.completion_tokens || null,
    total_tokens: params.usage?.total_tokens || null,
    image_tokens: params.imageTokensUsed > 0 ? params.imageTokensUsed : null,
    source_urls: params.guardrailSourceUrls,
    generation_source: params.generationSource,
  });

  if (aiLogError) {
    console.error('Erro ao registrar log de IA:', aiLogError);
  }
}
