import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Sparkles, Lightbulb, Clock, Search, Bot, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { GenerateForm } from "@/components/admin/ai-content/GenerateForm";
import type { GenerationProgress } from "@/components/admin/ai-content/SuggestionsList";
import { SuggestionsList } from "@/components/admin/ai-content/SuggestionsList";
import { PostsHistory } from "@/components/admin/ai-content/PostsHistory";
import { TopicSearchForm } from "@/components/admin/ai-content/TopicSearchForm";
import { TemplatesPanel } from "@/components/admin/ai-content/TemplatesPanel";
import { AutoGenerationPanel } from "@/components/admin/ai-content/AutoGenerationPanel";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { logger } from "@/lib/logger";

interface Suggestion {
  title: string;
  summary: string;
  category: string;
  keywords?: string[];
  mood?: string;
  visualElements?: string[];
  searchQuery?: string;
}

// Categorias que já têm sinais reais próprios (event_sources/scan) e continuam
// usando generate-blog-post-v2 + template dedicado — fora do escopo desta correção.
const TEMPLATE_ROUTED_CATEGORIES = ["eventos", "festivais", "entrevistas", "labels", "lançamentos", "lancamentos"];

// "Sugestões" (e qualquer categoria não mapeada) passou a ser ancorada em
// matéria real via generate-blog-post-from-topic, em vez do antigo template
// editorial sem fonte.
function isSugestoesCatchAll(category: string): boolean {
  const cat = (category || "").toLowerCase().trim();
  return !TEMPLATE_ROUTED_CATEGORIES.includes(cat);
}

interface BlogPost {
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

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  required_fields: string[];
  category: string;
}

export default function AIContent2() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const validTabs = ["generate", "suggestions", "topic", "history", "templates", "auto-generation"];
  const activeTab = validTabs.includes(searchParams.get("tab") || "")
    ? (searchParams.get("tab") as string)
    : "generate";

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<BlogPost[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generateWithImage, setGenerateWithImage] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [topicQuery, setTopicQuery] = useState("");
  const [isGeneratingFromTopic, setIsGeneratingFromTopic] = useState(false);
  const [suggestionsAutoPublish, setSuggestionsAutoPublish] = useState(false);

  const fetchSuggestionsAutoPublish = async () => {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "suggestions_auto_publish")
        .maybeSingle();

      setSuggestionsAutoPublish(data?.value === "true");
    } catch (error) {
      logger.error("Error fetching suggestions_auto_publish:", error);
    }
  };

  const initializeFormData = useCallback((fields: string[]) => {
    const initial: Record<string, string> = {};
    fields.forEach((field) => {
      initial[field] = "";
    });
    setFormData(initial);
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("ai_prompt_templates")
        .select("*")
        .eq("enabled", true)
        .order("is_default", { ascending: false });

      if (error) throw error;

      const mappedTemplates: PromptTemplate[] = (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description || "",
        // Normalizar required_fields - pode ser objeto ou array
        required_fields: (() => {
          if (Array.isArray(t.required_fields)) {
            return t.required_fields as string[];
          }
          if (typeof t.required_fields === 'object' && t.required_fields !== null) {
            return Object.keys(t.required_fields);
          }
          return [];
        })(),
        category: t.category || "",
      }));

      setTemplates(mappedTemplates);

      // Set default template
      const defaultTemplate = mappedTemplates.find((t) => t.category === "default") || mappedTemplates[0];
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
        initializeFormData(defaultTemplate.required_fields);
      }
    } catch (error) {
      logger.error("Error fetching templates:", error);
      toast({
        title: "Erro ao carregar templates",
        description: "Não foi possível carregar os templates de prompt.",
        variant: "destructive",
      });
    }
  }, [toast, initializeFormData]);

  const fetchGeneratedPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch recent blog posts
      const { data: posts, error: postsError } = await supabase
        .from("blog_posts")
        .select("id, title, slug, category, published, created_at, image_url")
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsError) throw postsError;

      // Fetch AI generation data for these posts
      const postIds = posts?.map((p) => p.id) || [];
      const { data: aiData, error: aiError } = await supabase
        .from("ai_generated_posts")
        .select("blog_post_id, model_used, total_tokens, image_tokens, generated_at, source_urls")
        .in("blog_post_id", postIds);

      if (aiError) throw aiError;

      // Merge data
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
              }
            : undefined,
        };
      });

      setGeneratedPosts(mergedPosts);
    } catch (error) {
      logger.error("Error fetching posts:", error);
      toast({
        title: "Erro ao carregar posts",
        description: "Não foi possível carregar o histórico de posts.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch initial data
  useEffect(() => {
    fetchTemplates();
    fetchGeneratedPosts();
    fetchSuggestionsAutoPublish();
  }, [fetchTemplates, fetchGeneratedPosts]);

  // Realtime: substitui o polling de 15s. Qualquer INSERT/UPDATE/DELETE em
  // blog_posts (incluindo a edge function que escreve image_url no background)
  // dispara um refresh imediato.
  useRealtimeTable("blog_posts", () => fetchGeneratedPosts());

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      initializeFormData(template.required_fields);
    }
  };

  const handleFormDataChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      topic: "Tópico",
      artist_name: "Nome do Artista",
      event_name: "Nome do Evento",
      track_name: "Nome da Track",
      genre: "Gênero",
      label_name: "Nome da Label",
      news_topic: "Tópico da Notícia",
      source_url: "URL da Fonte",
    };
    return labels[field] || field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({
        title: "Selecione um template",
        description: "Escolha um template antes de gerar o artigo.",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    const missingFields = selectedTemplate.required_fields.filter(
      (field) => !formData[field]?.trim()
    );

    if (missingFields.length > 0) {
      toast({
        title: "Campos obrigatórios",
        description: `Preencha: ${missingFields.map(getFieldLabel).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-post-v2", {
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
        },
      });

      if (error) throw error;

      toast({
        title: "Artigo gerado com sucesso!",
        description: `"${data.title}" foi criado e salvo como rascunho.`,
      });

      // Refresh posts list
      fetchGeneratedPosts();

      // Clear form
      initializeFormData(selectedTemplate.required_fields);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error("Error generating article:", error);
      toast({
        title: "Erro ao gerar artigo",
        description: message || "Ocorreu um erro durante a geração.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFromTopic = async () => {
    if (!topicQuery.trim()) return;

    setIsGeneratingFromTopic(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-post-from-topic", {
        body: {
          query: topicQuery.trim(),
          generateImage: generateWithImage,
        },
      });

      if (error) throw error;

      toast({
        title: "Artigo gerado a partir da busca!",
        description: `"${data.post?.title}" foi criado com base em ${data.sourcesUsed?.length ?? 0} fontes.`,
      });

      fetchGeneratedPosts();
      setTopicQuery("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error("Error generating from topic:", error);
      toast({
        title: "Erro ao gerar artigo por tema",
        description: message || "Ocorreu um erro durante a busca/geração.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingFromTopic(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    setIsLoadingSuggestions(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-suggestions", {
        body: { count: 5 },
      });

      if (error) throw error;

      // Normalizar keywords e visualElements (podem vir como string ou array)
      const normalizedSuggestions = (data.suggestions || []).map((s: any) => ({
        ...s,
        keywords: typeof s.keywords === 'string' 
          ? s.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
          : (Array.isArray(s.keywords) ? s.keywords : []),
        visualElements: typeof s.visualElements === 'string'
          ? s.visualElements.split(',').map((v: string) => v.trim()).filter(Boolean)
          : (Array.isArray(s.visualElements) ? s.visualElements : []),
      }));

      setSuggestions(normalizedSuggestions);

      toast({
        title: "Sugestões geradas!",
        description: `${data.suggestions?.length || 0} ideias de artigos foram geradas.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error("Error generating suggestions:", error);
      toast({
        title: "Erro ao gerar sugestões",
        description: message || "Ocorreu um erro ao buscar sugestões.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  /**
   * Escolhe o template correto para uma sugestão com base na categoria.
   * Evita o bug de TODA sugestão usar o template "Evento Padrão" — o que
   * forçava artigos editoriais a saírem com seção "Lineup" / "Local e horário".
   */
  const pickTemplateForSuggestion = (suggestion: Suggestion): PromptTemplate | null => {
    const cat = (suggestion.category || "").toLowerCase().trim();
    // Mapa categoria da sugestão → categoria do template no banco
    const findByCategory = (catName: string) =>
      templates.find((t) => t.category?.toLowerCase() === catName.toLowerCase());

    if (cat === "eventos") {
      return findByCategory("Eventos") || templates[0] || null;
    }
    if (cat === "festivais") {
      return findByCategory("Festivais") || findByCategory("Eventos") || templates[0] || null;
    }
    if (cat === "entrevistas") {
      return findByCategory("Entrevistas") || findByCategory("Sugestões") || templates[0] || null;
    }
    if (cat === "labels" || cat === "lançamentos" || cat === "lancamentos") {
      return findByCategory("Labels") || findByCategory("Sugestões") || templates[0] || null;
    }
    // Cultura, Tecnologia, Produtores, Cena e qualquer outra → template editorial "Sugestões"
    return findByCategory("Sugestões") || templates.find((t) => t.category?.toLowerCase() !== "eventos") || templates[0] || null;
  };

  const handleGenerateFromSuggestion = async (suggestion: Suggestion, index: number) => {
    setIsGenerating(true);
    setGeneratingIndex(index);

    try {
      if (isSugestoesCatchAll(suggestion.category)) {
        // Sugestões (e categorias não mapeadas) agora são ancoradas em matéria
        // real via busca, em vez do template editorial antigo sem fonte.
        const query = suggestion.searchQuery || suggestion.title;
        logger.debug(`[AIContent2] Sugestão "${suggestion.title}" (categoria=${suggestion.category}) → busca real: "${query}"`);

        const { data, error } = await supabase.functions.invoke("generate-blog-post-from-topic", {
          body: {
            query,
            generateImage: generateWithImage,
            publishImmediately: suggestionsAutoPublish,
          },
        });

        if (error) throw error;

        toast({
          title: "Artigo gerado!",
          description: `"${data.post?.title}" foi criado a partir de ${data.sourcesUsed?.length ?? 0} fontes reais.`,
        });
      } else {
        // Eventos/Festivais/Entrevistas/Labels continuam no fluxo de template dedicado.
        const template = pickTemplateForSuggestion(suggestion);

        if (!template) {
          throw new Error("Nenhum template disponível");
        }
        logger.debug(`[AIContent2] Sugestão "${suggestion.title}" (categoria=${suggestion.category}) → template "${template.name}"`);

        const { data, error } = await supabase.functions.invoke("generate-blog-post-v2", {
          body: {
            templateId: template.id,
            // Campos no root level que a edge function espera
            title: suggestion.title,
            eventName: suggestion.title,
            summary: suggestion.summary,
            category: suggestion.category,
            keywords: Array.isArray(suggestion.keywords) ? suggestion.keywords.join(", ") : (suggestion.keywords || ""),
            mood: suggestion.mood || "",
            visualElements: Array.isArray(suggestion.visualElements) ? suggestion.visualElements.join(", ") : (suggestion.visualElements || ""),
            generateImage: generateWithImage,
            // Manter formData para compatibilidade
            formData: {
              topic: suggestion.title,
              summary: suggestion.summary,
              category: suggestion.category,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "Artigo gerado!",
          description: `"${data.title}" foi criado a partir da sugestão.`,
        });
      }

      // Remove from suggestions
      setSuggestions((prev) => prev.filter((_, i) => i !== index));

      // Refresh posts
      fetchGeneratedPosts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error("Error generating from suggestion:", error);
      toast({
        title: "Erro ao gerar artigo",
        description: message || "Ocorreu um erro durante a geração.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(null);
    }
  };

  const handleRegenerateImage = async (postId: string) => {
    setRegeneratingId(postId);
    try {
      const { error } = await supabase.functions.invoke("regenerate-blog-image", {
        body: { postId },
      });

      if (error) throw error;

      toast({
        title: "Imagem regenerada!",
        description: "A nova capa foi gerada e salva.",
      });

      // O realtime já vai atualizar a lista quando o image_url mudar no banco,
      // mas forçamos um refresh imediato para feedback visual.
      fetchGeneratedPosts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error("Error regenerating image:", error);
      toast({
        title: "Erro ao regenerar imagem",
        description: message || "Ocorreu um erro ao gerar a nova capa.",
        variant: "destructive",
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleGenerateSelected = async (selected: Suggestion[]) => {
    if (selected.length === 0) return;

    setIsGenerating(true);
    
    // Initialize progress tracking
    const progress: GenerationProgress = {
      current: 0,
      total: selected.length,
      currentTitle: "",
      completed: [],
      failed: [],
    };
    setGenerationProgress(progress);

    try {
      for (let i = 0; i < selected.length; i++) {
        const suggestion = selected[i];
        const originalIndex = suggestions.findIndex((s) => s.title === suggestion.title);
        
        // Update progress
        progress.current = i + 1;
        progress.currentTitle = suggestion.title;
        setGenerationProgress({ ...progress });
        setGeneratingIndex(originalIndex);

        const useRealSearch = isSugestoesCatchAll(suggestion.category);
        const template = useRealSearch ? null : pickTemplateForSuggestion(suggestion);

        if (!useRealSearch && !template) {
          logger.debug(`[AIContent2 batch ${i + 1}/${selected.length}] "${suggestion.title}" (categoria=${suggestion.category}) → nenhum template disponível`);
          progress.failed.push(suggestion.title);
          setGenerationProgress({ ...progress });
          continue;
        }

        logger.debug(
          `[AIContent2 batch ${i + 1}/${selected.length}] "${suggestion.title}" (categoria=${suggestion.category}) → ${
            useRealSearch ? `busca real: "${suggestion.searchQuery || suggestion.title}"` : `template "${template?.name}"`
          }`
        );

        try {
          const { data, error } = useRealSearch
            ? await supabase.functions.invoke("generate-blog-post-from-topic", {
                body: {
                  query: suggestion.searchQuery || suggestion.title,
                  generateImage: generateWithImage,
                  publishImmediately: suggestionsAutoPublish,
                },
              })
            : await supabase.functions.invoke("generate-blog-post-v2", {
                body: {
                  templateId: template!.id,
                  title: suggestion.title,
                  eventName: suggestion.title,
                  summary: suggestion.summary,
                  category: suggestion.category,
                  keywords: Array.isArray(suggestion.keywords) ? suggestion.keywords.join(", ") : (suggestion.keywords || ""),
                  mood: suggestion.mood || "",
                  visualElements: Array.isArray(suggestion.visualElements) ? suggestion.visualElements.join(", ") : (suggestion.visualElements || ""),
                  generateImage: generateWithImage,
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
            
            toast({
              title: `Erro: ${suggestion.title.slice(0, 30)}...`,
              description: error.message || "Falha ao gerar artigo",
              variant: "destructive",
            });
          } else {
            progress.completed.push(suggestion.title);
            setGenerationProgress({ ...progress });
            
            // Remove generated suggestion
            setSuggestions((prev) => prev.filter((s) => s.title !== suggestion.title));
            
            const generatedTitle = data.post?.title || data.title || suggestion.title;
            toast({
              title: `Gerado: ${generatedTitle.slice(0, 30)}...`,
              description: "Artigo criado com sucesso!",
            });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Erro desconhecido";
          logger.error(`Error generating "${suggestion.title}":`, err);
          progress.failed.push(suggestion.title);
          setGenerationProgress({ ...progress });
          
          toast({
            title: `Erro: ${suggestion.title.slice(0, 30)}...`,
            description: message || "Falha ao gerar artigo",
            variant: "destructive",
          });
        }

        // Wait a bit between requests
        if (i < selected.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // Final summary toast
      const successCount = progress.completed.length;
      const failCount = progress.failed.length;
      
      toast({
        title: "Geração em lote concluída!",
        description: `${successCount} artigos gerados com sucesso${failCount > 0 ? `, ${failCount} falhas` : ""}.`,
        variant: failCount > 0 && successCount === 0 ? "destructive" : "default",
      });

      fetchGeneratedPosts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error("Error in batch generation:", error);
      toast({
        title: "Erro na geração em lote",
        description: message || "Alguns artigos podem não ter sido gerados.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(null);
      // Clear progress after a delay so user can see final state
      setTimeout(() => setGenerationProgress(null), 3000);
    }
  };

  return (
    <>
      <div className="w-full">
        <div className="w-full px-4 md:px-6 py-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
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
          <Tabs value={activeTab} onValueChange={(value) => setSearchParams(prev => { prev.set("tab", value); return prev; })} className="w-full">
            <TabsList className="grid w-full grid-cols-6 mb-6">
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
                  suggestions={suggestions}
                  generateWithImage={generateWithImage}
                  isLoadingSuggestions={isLoadingSuggestions}
                  isGenerating={isGenerating}
                  generatingIndex={generatingIndex}
                  generationProgress={generationProgress}
                  onGenerateSuggestions={handleGenerateSuggestions}
                  onGenerateWithImageChange={setGenerateWithImage}
                  onGenerateFromSuggestion={handleGenerateFromSuggestion}
                  onGenerateSelected={handleGenerateSelected}
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
    </>
  );
}
