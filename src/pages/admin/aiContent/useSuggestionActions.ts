import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { getEdgeFunctionErrorMessage } from '@/lib';
import { logger } from '@/lib/logger';
import type { GenerationProgress } from '@/components/admin/ai-content/SuggestionsList';
import {
  isSugestoesCatchAll,
  pickTemplateForSuggestion,
  type PromptTemplate,
  type SourcesPreviewState,
  type Suggestion,
} from './types';

interface Params {
  templates: PromptTemplate[];
  generateWithImage: boolean;
  suggestionsTopicAutoPublish: boolean;
  suggestionsTemplateAutoPublish: boolean;
  onPostsChanged: () => void;
  setIsGenerating: (v: boolean) => void;
}

/**
 * Encapsula toda a lógica da aba "Sugestões" e do dialog de preview de fontes.
 * Extraído de AIContent2.tsx (Onda Bônus PR-A) — comportamento 100% preservado.
 */
export function useSuggestionActions({
  templates,
  generateWithImage,
  suggestionsTopicAutoPublish,
  suggestionsTemplateAutoPublish,
  onPostsChanged,
  setIsGenerating,
}: Params) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [sourcesPreview, setSourcesPreview] = useState<SourcesPreviewState | null>(null);

  const handleGenerateSuggestions = async () => {
    setIsLoadingSuggestions(true);

    try {
      interface RawSuggestion {
        keywords?: string | string[];
        visualElements?: string | string[];
        [key: string]: unknown;
      }
      const { data, error } = await supabase.functions.invoke<{ suggestions?: RawSuggestion[] }>(
        'generate-blog-suggestions',
        {
          body: { count: 5 },
        }
      );

      if (error) throw error;

      const normalizedSuggestions = (data.suggestions || []).map((s) => ({
        ...s,
        keywords:
          typeof s.keywords === 'string'
            ? s.keywords
                .split(',')
                .map((k: string) => k.trim())
                .filter(Boolean)
            : Array.isArray(s.keywords)
              ? s.keywords
              : [],
        visualElements:
          typeof s.visualElements === 'string'
            ? s.visualElements
                .split(',')
                .map((v: string) => v.trim())
                .filter(Boolean)
            : Array.isArray(s.visualElements)
              ? s.visualElements
              : [],
      }));

      setSuggestions(normalizedSuggestions as unknown as Suggestion[]);

      toast({
        title: 'Sugestões geradas!',
        description: `${data.suggestions?.length || 0} ideias de artigos foram geradas.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error generating suggestions:', error);
      toast({
        title: 'Erro ao gerar sugestões',
        description: message || 'Ocorreu um erro ao buscar sugestões.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handlePreviewSources = async (suggestion: Suggestion) => {
    const query = suggestion.searchQuery || suggestion.title;
    setSourcesPreview({ query, isLoading: true, sources: null, error: null });

    try {
      const { data, error } = await supabase.functions.invoke('preview-topic-sources', {
        body: { query },
      });

      if (error) throw error;

      setSourcesPreview({ query, isLoading: false, sources: data?.sources ?? [], error: null });
    } catch (error) {
      logger.error('[AIContent2] Erro ao pré-visualizar fontes:', error);
      setSourcesPreview({
        query,
        isLoading: false,
        sources: null,
        error: await getEdgeFunctionErrorMessage(error),
      });
    }
  };

  const handleGenerateFromSuggestion = async (suggestion: Suggestion, index: number) => {
    setIsGenerating(true);
    setGeneratingIndex(index);

    try {
      if (isSugestoesCatchAll(suggestion.category)) {
        const query = suggestion.searchQuery || suggestion.title;
        logger.debug(
          `[AIContent2] Sugestão "${suggestion.title}" (categoria=${suggestion.category}) → busca real: "${query}"`
        );

        const { data, error } = await supabase.functions.invoke('generate-blog-post-from-topic', {
          body: {
            query,
            generateImage: generateWithImage,
            publishImmediately: suggestionsTopicAutoPublish,
            generationSource: 'sugestoes_tema',
          },
        });

        if (error) throw error;

        toast({
          title: 'Artigo gerado!',
          description: `"${data.post?.title}" foi criado a partir de ${data.sourcesUsed?.length ?? 0} fontes reais.`,
        });
      } else {
        const template = pickTemplateForSuggestion(suggestion, templates);

        if (!template) {
          throw new Error('Nenhum template disponível');
        }
        logger.debug(
          `[AIContent2] Sugestão "${suggestion.title}" (categoria=${suggestion.category}) → template "${template.name}"`
        );

        const { data, error } = await supabase.functions.invoke('generate-blog-post-v2', {
          body: {
            templateId: template.id,
            title: suggestion.title,
            eventName: suggestion.title,
            summary: suggestion.summary,
            category: suggestion.category,
            keywords: Array.isArray(suggestion.keywords)
              ? suggestion.keywords.join(', ')
              : suggestion.keywords || '',
            mood: suggestion.mood || '',
            visualElements: Array.isArray(suggestion.visualElements)
              ? suggestion.visualElements.join(', ')
              : suggestion.visualElements || '',
            generateImage: generateWithImage,
            publishImmediately: suggestionsTemplateAutoPublish,
            generationSource: 'sugestoes_template',
            formData: {
              topic: suggestion.title,
              summary: suggestion.summary,
              category: suggestion.category,
            },
          },
        });

        if (error) throw error;

        toast({
          title: 'Artigo gerado!',
          description: `"${data.title}" foi criado a partir da sugestão.`,
        });
      }

      setSuggestions((prev) => prev.filter((_, i) => i !== index));
      onPostsChanged();
    } catch (error: unknown) {
      const message = await getEdgeFunctionErrorMessage(error);
      logger.error('Error generating from suggestion:', error);
      toast({
        title: 'Erro ao gerar artigo',
        description: message || 'Ocorreu um erro durante a geração.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(null);
    }
  };

  const handleGenerateSelected = async (selected: Suggestion[]) => {
    if (selected.length === 0) return;

    setIsGenerating(true);

    const progress: GenerationProgress = {
      current: 0,
      total: selected.length,
      currentTitle: '',
      completed: [],
      failed: [],
    };
    setGenerationProgress(progress);

    try {
      for (let i = 0; i < selected.length; i++) {
        const suggestion = selected[i];
        const originalIndex = suggestions.findIndex((s) => s.title === suggestion.title);

        progress.current = i + 1;
        progress.currentTitle = suggestion.title;
        setGenerationProgress({ ...progress });
        setGeneratingIndex(originalIndex);

        const useRealSearch = isSugestoesCatchAll(suggestion.category);
        const template = useRealSearch ? null : pickTemplateForSuggestion(suggestion, templates);

        if (!useRealSearch && !template) {
          logger.debug(
            `[AIContent2 batch ${i + 1}/${selected.length}] "${suggestion.title}" (categoria=${suggestion.category}) → nenhum template disponível`
          );
          progress.failed.push(suggestion.title);
          setGenerationProgress({ ...progress });
          continue;
        }

        logger.debug(
          `[AIContent2 batch ${i + 1}/${selected.length}] "${suggestion.title}" (categoria=${suggestion.category}) → ${
            useRealSearch
              ? `busca real: "${suggestion.searchQuery || suggestion.title}"`
              : `template "${template?.name}"`
          }`
        );

        try {
          const { data, error } = useRealSearch
            ? await supabase.functions.invoke('generate-blog-post-from-topic', {
                body: {
                  query: suggestion.searchQuery || suggestion.title,
                  generateImage: generateWithImage,
                  publishImmediately: suggestionsTopicAutoPublish,
                  generationSource: 'sugestoes_tema',
                },
              })
            : await supabase.functions.invoke('generate-blog-post-v2', {
                body: {
                  templateId: template!.id,
                  title: suggestion.title,
                  eventName: suggestion.title,
                  summary: suggestion.summary,
                  category: suggestion.category,
                  keywords: Array.isArray(suggestion.keywords)
                    ? suggestion.keywords.join(', ')
                    : suggestion.keywords || '',
                  mood: suggestion.mood || '',
                  visualElements: Array.isArray(suggestion.visualElements)
                    ? suggestion.visualElements.join(', ')
                    : suggestion.visualElements || '',
                  generateImage: generateWithImage,
                  publishImmediately: suggestionsTemplateAutoPublish,
                  generationSource: 'sugestoes_template',
                  formData: {
                    topic: suggestion.title,
                    summary: suggestion.summary,
                    category: suggestion.category,
                  },
                },
              });

          if (error) {
            logger.error(`Error generating "${suggestion.title}":`, error);
            progress.failed.push(suggestion.title);
            setGenerationProgress({ ...progress });

            const batchErrorMessage = await getEdgeFunctionErrorMessage(error);
            toast({
              title: `Erro: ${suggestion.title.slice(0, 30)}...`,
              description: batchErrorMessage || 'Falha ao gerar artigo',
              variant: 'destructive',
            });
          } else {
            progress.completed.push(suggestion.title);
            setGenerationProgress({ ...progress });

            setSuggestions((prev) => prev.filter((s) => s.title !== suggestion.title));

            const generatedTitle = data.post?.title || data.title || suggestion.title;
            toast({
              title: `Gerado: ${generatedTitle.slice(0, 30)}...`,
              description: 'Artigo criado com sucesso!',
            });
          }
        } catch (err: unknown) {
          const message = await getEdgeFunctionErrorMessage(err);
          logger.error(`Error generating "${suggestion.title}":`, err);
          progress.failed.push(suggestion.title);
          setGenerationProgress({ ...progress });

          toast({
            title: `Erro: ${suggestion.title.slice(0, 30)}...`,
            description: message || 'Falha ao gerar artigo',
            variant: 'destructive',
          });
        }

        if (i < selected.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      const successCount = progress.completed.length;
      const failCount = progress.failed.length;

      toast({
        title: 'Geração em lote concluída!',
        description: `${successCount} artigos gerados com sucesso${failCount > 0 ? `, ${failCount} falhas` : ''}.`,
        variant: failCount > 0 && successCount === 0 ? 'destructive' : 'default',
      });

      onPostsChanged();
    } catch (error: unknown) {
      const message = await getEdgeFunctionErrorMessage(error);
      logger.error('Error in batch generation:', error);
      toast({
        title: 'Erro na geração em lote',
        description: message || 'Alguns artigos podem não ter sido gerados.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(null);
      setTimeout(() => setGenerationProgress(null), 3000);
    }
  };

  return {
    suggestions,
    isLoadingSuggestions,
    generatingIndex,
    generationProgress,
    sourcesPreview,
    setSourcesPreview,
    handleGenerateSuggestions,
    handlePreviewSources,
    handleGenerateFromSuggestion,
    handleGenerateSelected,
  };
}
