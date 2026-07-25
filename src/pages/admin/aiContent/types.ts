/**
 * Tipos e helpers puros compartilhados pela página AIContent2 (Onda Bônus).
 */

export interface Suggestion {
  title: string;
  summary: string;
  category: string;
  keywords?: string[];
  mood?: string;
  visualElements?: string[];
  searchQuery?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  created_at: string;
  image_url?: string | null;
  ai_data?: {
    model_used?: string;
    total_tokens?: number;
    image_tokens?: number;
    generated_at?: string;
    source_urls?: string[] | null;
  };
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  /** Todos os campos configurados no template (obrigatórios + opcionais). */
  allFields: string[];
  /** Só os campos marcados como obrigatórios. */
  required_fields: string[];
  category: string;
}

export interface SourcesPreviewState {
  query: string;
  isLoading: boolean;
  sources: { title: string; url: string }[] | null;
  error: string | null;
}

/**
 * Categorias que têm sinais reais próprios vindos de event_sources/scan e
 * continuam usando generate-blog-post-v2 + template dedicado.
 */
export const TEMPLATE_ROUTED_CATEGORIES = ['entrevistas', 'labels'];

/**
 * "Sugestões" (e qualquer categoria não mapeada) é ancorada em matéria real
 * via generate-blog-post-from-topic.
 */
export function isSugestoesCatchAll(category: string): boolean {
  const cat = (category || '').toLowerCase().trim();
  return !TEMPLATE_ROUTED_CATEGORIES.includes(cat);
}

export function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    topic: 'Tópico',
    artist_name: 'Nome do Artista',
    event_name: 'Nome do Evento',
    track_name: 'Nome da Track',
    genre: 'Gênero',
    label_name: 'Nome da Label',
    news_topic: 'Tópico da Notícia',
    source_url: 'URL da Fonte',
  };
  return labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Escolhe o template correto para uma sugestão com base na categoria.
 */
export function pickTemplateForSuggestion(
  suggestion: Suggestion,
  templates: PromptTemplate[]
): PromptTemplate | null {
  const cat = (suggestion.category || '').toLowerCase().trim();
  const findByCategory = (catName: string) =>
    templates.find((t) => t.category?.toLowerCase() === catName.toLowerCase());

  if (cat === 'entrevistas') {
    return findByCategory('Entrevistas') || findByCategory('Sugestões') || templates[0] || null;
  }
  if (cat === 'labels') {
    return findByCategory('Labels') || findByCategory('Sugestões') || templates[0] || null;
  }
  return (
    findByCategory('Sugestões') ||
    templates.find((t) => t.category?.toLowerCase() !== 'eventos') ||
    templates[0] ||
    null
  );
}
