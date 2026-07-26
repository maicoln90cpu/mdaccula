// Persistência do post (slug único, insert/update, log de IA) extraída de
// generate-blog-post-v2/index.ts (Onda 22). Comportamento preservado 1:1.
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

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      title: eventData.title,
      slug,
      excerpt: eventData.excerpt,
      content: eventData.content,
      category: finalCategory,
      published: publishImmediately === false ? false : true,
      published_at: publishImmediately === false ? null : new Date().toISOString(),
      image_url: generatedImageUrl,
    })
    .select()
    .single();
  return { post: data, error };
}

export interface LogAiGenerationParams {
  postId: string;
  templateName: string;
  templateId: string;
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
  });

  if (aiLogError) {
    console.error('Erro ao registrar log de IA:', aiLogError);
  }
}
