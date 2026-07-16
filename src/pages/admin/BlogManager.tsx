import { useEffect, useState } from "react";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Loader2, Plus, Pencil, Trash2, ArrowLeft, ImagePlus, Image, RefreshCw, FileSearch } from "lucide-react";
import { BlogForm } from "@/components/blog/BlogForm";
import { NavLink } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { logger } from "@/lib/logger";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  views: number;
  likes: number;
  created_at: string;
  image_url: string | null;
  excerpt: string | null;
  content: string;
}

const BlogManager = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | undefined>();
  const [regeneratingImageId, setRegeneratingImageId] = useState<string | null>(null);
  const [regeneratingPostId, setRegeneratingPostId] = useState<string | null>(null);
  const [sourcesPostId, setSourcesPostId] = useState<string | null>(null);
  const [sourcesInfo, setSourcesInfo] = useState<{
    functionLabel: string | null;
    sources: { name: string; url: string; kind: "origin" | "context" }[];
  } | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, category, published, views, likes, created_at, image_url, excerpt, content")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      logger.error("Error fetching posts:", error);
      toast.error("Erro ao carregar posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Realtime: lista atualiza automaticamente em qualquer INSERT/UPDATE/DELETE
  // (inclui mudanças vindas de outras abas, edge functions e regenerate-image).
  useRealtimeTable("blog_posts", () => fetchPosts());

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingPost(undefined);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingPost(undefined);
    fetchPosts();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingPost(undefined);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Post deletado com sucesso!");
      fetchPosts();
    } catch (error) {
      logger.error("Error deleting post:", error);
      toast.error("Erro ao deletar post");
    } finally {
      setDeletingId(null);
    }
  };

  const togglePublished = async (id: string, published: boolean) => {
    try {
      const { error } = await supabase
        .from("blog_posts")
        .update({ 
          published,
          published_at: published ? new Date().toISOString() : null
        })
        .eq("id", id);
      
      if (error) throw error;
      toast.success(published ? "Post publicado!" : "Post despublicado!");
      fetchPosts();
    } catch (error) {
      logger.error("Error updating post:", error);
      toast.error("Erro ao atualizar post");
    }
  };

  const handleRegenerateImage = async (postId: string, postTitle: string) => {
    setRegeneratingImageId(postId);
    toast.info(`Gerando imagem para "${postTitle}"...`);
    
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-blog-image', {
        body: { postId }
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success('Imagem regenerada com sucesso!');
        fetchPosts();
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      logger.error('Error regenerating image:', error);
      toast.error(`Erro ao regenerar imagem: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setRegeneratingImageId(null);
    }
  };

  const handleRegeneratePost = async (postId: string, postTitle: string) => {
    setRegeneratingPostId(postId);
    toast.info(`Regenerando artigo "${postTitle}"...`);
    
    try {
      // Buscar TODOS os eventos vinculados ao post
      const { data: linkedEvents, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('blog_post_id', postId);
      
      if (eventError) {
        throw new Error(`Erro ao buscar eventos: ${eventError.message}`);
      }

      if (!linkedEvents || linkedEvents.length === 0) {
        throw new Error('Nenhum evento vinculado a este post. Só é possível regenerar posts criados a partir de eventos.');
      }
      
      // Se tiver 2+ eventos, usar generate-multi-event-article
      if (linkedEvents.length >= 2) {
        logger.debug('[BlogManager] Regenerando artigo multi-eventos', { eventsCount: linkedEvents.length });
        
        const { data, error } = await supabase.functions.invoke('generate-multi-event-article', {
          body: {
            eventIds: linkedEvents.map(e => e.id),
            seriesName: linkedEvents[0].title, // usar título do evento (dados frescos), não do post antigo
            existingPostId: postId, // regenerar no mesmo post
            generateImage: false // manter imagem
          }
        });
        
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro ao regenerar');
        
        toast.success('Artigo multi-eventos regenerado com sucesso!');
      } else {
        // Evento único: comportamento atual
        const event = linkedEvents[0];
        
        // Compor eventLocation
        const eventLocation = [event.venue, event.location_city, event.location_state]
          .filter(Boolean).join(' - ');
        
        // Chamar edge function para gerar novo conteúdo
        const payload = {
          eventName: event.title,
          title: event.title,
          eventLocation,
          venue: event.venue,
          eventDate: event.date,
          eventTime: event.time,
          locationCity: event.location_city,
          locationState: event.location_state,
          description: event.description || '',
          genres: event.genres?.join(', ') || '',
          lineup: event.lineup?.join(', ') || '',
          ticketLink: event.ticket_link || '',
          vipLink: event.vip_link || '',
          eventImageUrl: event.image_url || '',
          category: 'Eventos',
          tone: 'engaging',
          generateImage: false, // manter imagem existente
          existingPostId: postId, // ID do post para atualizar
        };
        
        const { data, error } = await supabase.functions.invoke('generate-blog-post-v2', {
          body: payload,
        });
        
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro ao regenerar');
        
        toast.success('Artigo regenerado com sucesso!');
      }
      
      fetchPosts();
    } catch (error: any) {
      logger.error('Error regenerating post:', error);
      toast.error(`Erro ao regenerar: ${error.message}`);
    } finally {
      setRegeneratingPostId(null);
    }
  };

  const handleShowSources = async (postId: string) => {
    setSourcesPostId(postId);
    setSourcesInfo(null);

    try {
      const [{ data: genRows }, { data: draft }] = await Promise.all([
        // Regenerar um artigo insere uma NOVA linha em ai_generated_posts (nunca
        // atualiza a existente) — pega sempre a mais recente pra refletir a última
        // geração de fato usada.
        supabase
          .from("ai_generated_posts")
          .select("template_id, prompt_used, source_urls")
          .eq("blog_post_id", postId)
          .order("generated_at", { ascending: false })
          .limit(1),
        supabase
          .from("event_watch_drafts")
          .select("source_page_url, event_sources(name, url)")
          .eq("published_blog_post_id", postId)
          .maybeSingle(),
      ]);
      const gen = genRows?.[0] ?? null;

      let functionLabel: string | null = null;
      if (gen?.template_id) {
        const { data: template } = await supabase
          .from("ai_prompt_templates")
          .select("name")
          .eq("id", gen.template_id)
          .maybeSingle();
        functionLabel = template?.name ?? "Geração por IA";
      } else if (gen?.prompt_used?.startsWith("Multi-Event Article")) {
        functionLabel = "Geração de Multi-Eventos";
      } else if (gen?.prompt_used?.startsWith("Busca por tema")) {
        functionLabel = "Geração por Tema";
      } else if (gen) {
        functionLabel = "Geração por IA";
      }

      const sources: { name: string; url: string; kind: "origin" | "context" }[] = [];
      if (draft?.event_sources) {
        sources.push({
          name: draft.event_sources.name,
          // Prefere a página exata da notícia (extraída do conteúdo raspado) e só
          // cai pra URL raiz da fonte quando a IA não identificou um link específico.
          url: draft.source_page_url || draft.event_sources.url,
          kind: "origin",
        });
      }

      const contextUrls: string[] = gen?.source_urls ?? [];
      if (contextUrls.length > 0) {
        // A URL de contexto pode ser um link de artigo específico (não a URL
        // raiz cadastrada em event_sources), então casa por hostname em vez
        // de igualdade exata pra achar o nome amigável da fonte.
        const { data: allSources } = await supabase.from("event_sources").select("name, url");

        contextUrls.forEach((url) => {
          let hostname = url;
          try {
            hostname = new URL(url).hostname;
          } catch {
            // mantém a URL crua se não for parseável
          }
          const match = allSources?.find((s) => {
            try {
              return new URL(s.url).hostname === hostname;
            } catch {
              return false;
            }
          });
          sources.push({ name: match?.name ?? hostname, url, kind: "context" });
        });
      }

      setSourcesInfo({ functionLabel, sources });
    } catch (error) {
      logger.error("Error fetching sources info:", error);
      toast.error("Erro ao carregar fontes e origem do artigo");
      setSourcesPostId(null);
    }
  };

  return (
    <>
      <div className="w-full">
        <main className="w-full">
          <div className="w-full px-4 md:px-6 py-6">
            <div className="mb-4">
              <NavLink to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Painel
              </NavLink>
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
              <h1 className="text-4xl font-bold hero-text">Gerenciar Blog</h1>
              <Button onClick={handleNew} className="btn-neon">
                <Plus className="w-4 h-4 mr-2" />
                Novo Post
              </Button>
            </div>

            {showForm ? (
              <BlogForm
                post={editingPost}
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            ) : (
              <>
                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : posts.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <p className="text-muted-foreground text-lg mb-4">
                        Nenhum post encontrado. Crie seu primeiro post!
                      </p>
                      <Button onClick={handleNew}>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Primeiro Post
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {posts.map((post) => (
                      <Card key={post.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                              {/* Thumbnail preview */}
                              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                {post.image_url ? (
                                  <img 
                                    src={getOptimizedImageUrl(post.image_url)} 
                                    alt={post.title}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                    <Image className="w-6 h-6" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <CardTitle className="text-base">{post.title}</CardTitle>
                                <div className="flex gap-2 mt-2 flex-wrap">
                                  <Badge variant={post.published ? "default" : "secondary"}>
                                    {post.published ? "Publicado" : "Rascunho"}
                                  </Badge>
                                  <Badge variant="outline">{post.category}</Badge>
                                  {!post.image_url && (
                                    <Badge variant="destructive" className="text-xs">
                                      Sem imagem
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Eye className="w-4 h-4 mr-1" />
                                {post.views}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(post)}
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRegeneratePost(post.id, post.title)}
                                    disabled={regeneratingPostId === post.id}
                                  >
                                    {regeneratingPostId === post.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Regenerar artigo com IA</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRegenerateImage(post.id, post.title)}
                                    disabled={regeneratingImageId === post.id}
                                  >
                                    {regeneratingImageId === post.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <ImagePlus className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{post.image_url ? 'Regenerar imagem' : 'Gerar imagem'}</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleShowSources(post.id)}
                                  >
                                    <FileSearch className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ver fontes e origem</p>
                                </TooltipContent>
                              </Tooltip>
                              <Button
                                variant={post.published ? "outline" : "default"}
                                size="sm"
                                onClick={() => togglePublished(post.id, !post.published)}
                              >
                                {post.published ? "Despublicar" : "Publicar"}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeletingId(post.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
        <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja deletar este post? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingId && handleDelete(deletingId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Deletar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog open={!!sourcesPostId} onOpenChange={(open) => !open && setSourcesPostId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Fontes e origem do artigo</DialogTitle>
            </DialogHeader>
            {!sourcesInfo ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Gerado por</p>
                  <p>{sourcesInfo.functionLabel ?? "Criado manualmente, sem dados de geração por IA."}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Fontes usadas</p>
                  {sourcesInfo.sources.length === 0 ? (
                    <p className="text-muted-foreground">Nenhuma fonte registrada.</p>
                  ) : (
                    <ul className="space-y-3">
                      {sourcesInfo.sources.map((source, i) => (
                        <li key={i} className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            {source.kind === "origin" ? "Fonte de origem" : "Contexto adicional"}
                          </p>
                          <p className="font-medium">{source.name}</p>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline break-all"
                          >
                            {source.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default BlogManager;
