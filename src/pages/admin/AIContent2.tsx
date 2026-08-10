import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Sparkles, Lightbulb, Clock, Search, Bot, Wand2, LayoutDashboard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { GenerateForm } from '@/components/admin/ai-content/GenerateForm';
import { SuggestionsList } from '@/components/admin/ai-content/SuggestionsList';
import { PostsHistory } from '@/components/admin/ai-content/PostsHistory';
import { TopicSearchForm } from '@/components/admin/ai-content/TopicSearchForm';
import { TemplatesPanel } from '@/components/admin/ai-content/TemplatesPanel';
import { AutoGenerationPanel } from '@/components/admin/ai-content/AutoGenerationPanel';
import { ContentDashboard } from '@/components/admin/ai-content/ContentDashboard';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { useAutoPublishSettings } from '@/hooks/useAutoPublishSettings';
import { normalizePromptTemplateFields, getEdgeFunctionErrorMessage } from '@/lib';
import { logger } from '@/lib/logger';
import { SourcesPreviewDialog } from './aiContent/SourcesPreviewDialog';
import { useSuggestionActions } from './aiContent/useSuggestionActions';
import { getFieldLabel, type BlogPost, type PromptTemplate } from './aiContent/types';

export default function AIContent2() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const validTabs = ['dashboard', 'generate', 'suggestions', 'topic', 'history', 'templates', 'auto-generation'];
  const activeTab = validTabs.includes(searchParams.get('tab') || '')
    ? (searchParams.get('tab') as string)
    : 'dashboard';

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<BlogPost[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generateWithImage, setGenerateWithImage] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [topicQuery, setTopicQuery] = useState('');
  const [isGeneratingFromTopic, setIsGeneratingFromTopic] = useState(false);
  const { settings: publishSettings } = useAutoPublishSettings([
    'auto_publish_generate_tab',
    'auto_publish_topic_search',
    'auto_publish_suggestions_topic',
    'auto_publish_suggestions_template',
  ]);

  const initializeFormData = useCallback((fields: string[]) => {
    const initial: Record<string, string> = {};
    fields.forEach((field) => {
      initial[field] = '';
    });
    setFormData(initial);
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('enabled', true)
        .order('is_default', { ascending: false });

      if (error) throw error;

      const mappedTemplates: PromptTemplate[] = (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        ...(() => {
          const { allFields, requiredFields } = normalizePromptTemplateFields(t.required_fields);
          return { allFields, required_fields: requiredFields };
        })(),
        category: t.category || '',
      }));

      setTemplates(mappedTemplates);

      const defaultTemplate =
        mappedTemplates.find((t) => t.category === 'default') || mappedTemplates[0];
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
        initializeFormData(defaultTemplate.allFields);
      }
    } catch (error) {
      logger.error('Error fetching templates:', error);
      toast({
        title: 'Erro ao carregar templates',
        description: 'Não foi possível carregar os templates de prompt.',
        variant: 'destructive',
      });
    }
  }, [toast, initializeFormData]);

  const fetchGeneratedPosts = useCallback(async () => {
    try {
      setIsLoading(true);

      const { data: posts, error: postsError } = await supabase
        .from('blog_posts')
        .select('id, title, slug, category, published, created_at, image_url')
        .order('created_at', { ascending: false })
        .limit(50);

      if (postsError) throw postsError;

      const postIds = posts?.map((p) => p.id) || [];
      const { data: aiData, error: aiError } = await supabase
        .from('ai_generated_posts')
        .select('blog_post_id, model_used, total_tokens, image_tokens, generated_at, source_urls, generation_source')
        .in('blog_post_id', postIds);

      if (aiError) throw aiError;

      const mergedPosts: BlogPost[] = (posts || []).map((post) => {
        const ai = aiData?.find((a) => a.blog_post_id === post.id);
        return {
          ...post,
          ai_data: ai
            ? {
                model_used: ai.model_used || undefined,
                total_tokens: ai.total_tokens || undefined,
                image_tokens: ai.image_tokens || undefined,
                generated_at: ai.generated_at || undefined,
                source_urls: ai.source_urls || undefined,
                generation_source: ai.generation_source || undefined,
              }
            : undefined,
        };
      });

      setGeneratedPosts(mergedPosts);
    } catch (error) {
      logger.error('Error fetching posts:', error);
      toast({
        title: 'Erro ao carregar posts',
        description: 'Não foi possível carregar o histórico de posts.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTemplates();
    fetchGeneratedPosts();
  }, [fetchTemplates, fetchGeneratedPosts]);

  // Realtime: substitui o polling de 15s.
  useRealtimeTable('blog_posts', () => fetchGeneratedPosts());

  const suggestionActions = useSuggestionActions({
    templates,
    generateWithImage,
    suggestionsTopicAutoPublish: publishSettings.auto_publish_suggestions_topic === true,
    suggestionsTemplateAutoPublish: publishSettings.auto_publish_suggestions_template === true,
    onPostsChanged: fetchGeneratedPosts,
    setIsGenerating,
  });

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      initializeFormData(template.allFields);
    }
  };

  const handleFormDataChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({
        title: 'Selecione um template',
        description: 'Escolha um template antes de gerar o artigo.',
        variant: 'destructive',
      });
      return;
    }

    const missingFields = selectedTemplate.required_fields.filter(
      (field) => !formData[field]?.trim()
    );

    if (missingFields.length > 0) {
      toast({
        title: 'Campos obrigatórios',
        description: `Preencha: ${missingFields.map(getFieldLabel).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const willPublish = publishSettings.auto_publish_generate_tab === true;
      const { data, error } = await supabase.functions.invoke('generate-blog-post-v2', {
        body: {
          templateId: selectedTemplate.id,
          ...formData,
          eventName:
            formData.eventName ||
            formData.title ||
            formData.festivalName ||
            formData.labelName ||
            Object.values(formData).find((value) => value?.trim()),
          generateImage: generateWithImage,
          publishImmediately: willPublish,
          generationSource: 'gerar_tab',
        },
      });

      if (error) throw error;

      toast({
        title: 'Artigo gerado com sucesso!',
        description: `"${data.title}" foi ${willPublish ? 'criado e publicado' : 'criado e salvo como rascunho'}.`,
      });

      fetchGeneratedPosts();
      initializeFormData(selectedTemplate.allFields);
    } catch (error: unknown) {
      const message = await getEdgeFunctionErrorMessage(error);
      logger.error('Error generating article:', error);
      toast({
        title: 'Erro ao gerar artigo',
        description: message || 'Ocorreu um erro durante a geração.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFromTopic = async () => {
    if (!topicQuery.trim()) return;

    setIsGeneratingFromTopic(true);

    try {
      const willPublish = publishSettings.auto_publish_topic_search === true;
      const { data, error } = await supabase.functions.invoke('generate-blog-post-from-topic', {
        body: {
          query: topicQuery.trim(),
          generateImage: generateWithImage,
          publishImmediately: willPublish,
          generationSource: 'por_tema',
        },
      });

      if (error) throw error;

      toast({
        title: 'Artigo gerado a partir da busca!',
        description: `"${data.post?.title}" foi ${willPublish ? 'publicado' : 'salvo como rascunho'}, com base em ${data.sourcesUsed?.length ?? 0} fontes.`,
      });

      fetchGeneratedPosts();
      setTopicQuery('');
    } catch (error: unknown) {
      const message = await getEdgeFunctionErrorMessage(error);
      logger.error('Error generating from topic:', error);
      toast({
        title: 'Erro ao gerar artigo por tema',
        description: message || 'Ocorreu um erro durante a busca/geração.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingFromTopic(false);
    }
  };

  const handleRegenerateImage = async (postId: string) => {
    setRegeneratingId(postId);
    try {
      const { error } = await supabase.functions.invoke('regenerate-blog-image', {
        body: { postId },
      });

      if (error) throw error;

      toast({
        title: 'Imagem regenerada!',
        description: 'A nova capa foi gerada e salva.',
      });

      fetchGeneratedPosts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error regenerating image:', error);
      toast({
        title: 'Erro ao regenerar imagem',
        description: message || 'Ocorreu um erro ao gerar a nova capa.',
        variant: 'destructive',
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <>
      <div className="w-full">
        <div className="w-full px-4 md:px-6 py-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">IA Gerador de Conteúdo</h1>
                  <Badge variant="secondary">V2</Badge>
                </div>
                <p className="text-muted-foreground mt-1">
                  Gere artigos com inteligência artificial usando templates personalizados
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setSearchParams((prev) => {
                prev.set('tab', value);
                return prev;
              })
            }
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-7 mb-6">
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="generate" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Gerar
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                Sugestões
              </TabsTrigger>
              <TabsTrigger value="topic" className="gap-2">
                <Search className="h-4 w-4" />
                Por Tema
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Clock className="h-4 w-4" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <Bot className="h-4 w-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="auto-generation" className="gap-2">
                <Wand2 className="h-4 w-4" />
                Automático
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <div className="w-full">
                <ContentDashboard />
              </div>
            </TabsContent>

            <TabsContent value="generate">
              <div className="w-full">
                <GenerateForm
                  templates={templates}
                  selectedTemplate={selectedTemplate}
                  formData={formData}
                  generateWithImage={generateWithImage}
                  isGenerating={isGenerating}
                  onTemplateChange={handleTemplateChange}
                  onFormDataChange={handleFormDataChange}
                  onGenerateWithImageChange={setGenerateWithImage}
                  onGenerate={handleGenerate}
                  getFieldLabel={getFieldLabel}
                />
              </div>
            </TabsContent>

            <TabsContent value="suggestions">
              <div className="w-full">
                <SuggestionsList
                  suggestions={suggestionActions.suggestions}
                  generateWithImage={generateWithImage}
                  isLoadingSuggestions={suggestionActions.isLoadingSuggestions}
                  isGenerating={isGenerating}
                  generatingIndex={suggestionActions.generatingIndex}
                  generationProgress={suggestionActions.generationProgress}
                  onGenerateSuggestions={suggestionActions.handleGenerateSuggestions}
                  onGenerateWithImageChange={setGenerateWithImage}
                  onGenerateFromSuggestion={suggestionActions.handleGenerateFromSuggestion}
                  onGenerateSelected={suggestionActions.handleGenerateSelected}
                  onPreviewSources={suggestionActions.handlePreviewSources}
                />
              </div>
            </TabsContent>

            <TabsContent value="topic">
              <div className="w-full">
                <TopicSearchForm
                  topicQuery={topicQuery}
                  generateWithImage={generateWithImage}
                  isGenerating={isGeneratingFromTopic}
                  onTopicQueryChange={setTopicQuery}
                  onGenerateWithImageChange={setGenerateWithImage}
                  onGenerate={handleGenerateFromTopic}
                />
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="w-full">
                <PostsHistory
                  posts={generatedPosts}
                  isLoading={isLoading}
                  onRegenerateImage={handleRegenerateImage}
                  regeneratingId={regeneratingId}
                />
              </div>
            </TabsContent>

            <TabsContent value="templates">
              <TemplatesPanel />
            </TabsContent>

            <TabsContent value="auto-generation">
              <AutoGenerationPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <SourcesPreviewDialog
        state={suggestionActions.sourcesPreview}
        onClose={() => suggestionActions.setSourcesPreview(null)}
      />
    </>
  );
}
