import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOptimizedImageUrl, IMAGE_PRESETS } from "@/lib/imageUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Edit, ExternalLink, Sparkles, Clock, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  };
}

interface PostsHistoryProps {
  posts: BlogPost[];
  isLoading: boolean;
}

export function PostsHistory({ posts, isLoading }: PostsHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Posts</CardTitle>
          <CardDescription>Carregando posts gerados...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <Skeleton className="h-16 w-16 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Histórico de Posts
        </CardTitle>
        <CardDescription>
          Últimos {posts.length} posts gerados com IA
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">
                Nenhum post gerado ainda
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Use a aba "Gerar" para criar seu primeiro artigo com IA
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start gap-4 p-4 rounded-lg border hover:border-primary/50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
                    {post.image_url ? (
                      <img
                        src={getOptimizedImageUrl(post.image_url, IMAGE_PRESETS.thumbnail)}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium leading-tight line-clamp-2">
                        {post.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {post.ai_data && (
                          <Badge variant="secondary" className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            IA
                          </Badge>
                        )}
                        <Badge variant={post.published ? "default" : "outline"}>
                          {post.published ? "Publicado" : "Rascunho"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {post.category}
                      </Badge>
                      <span>•</span>
                      <span>
                        {format(new Date(post.created_at), "dd MMM yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                      {post.ai_data?.model_used && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{post.ai_data.model_used}</span>
                        </>
                      )}
                      {post.ai_data?.total_tokens && (
                        <>
                          <span>•</span>
                          <span>{post.ai_data.total_tokens.toLocaleString()} tokens</span>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/blog/${post.slug}`} target="_blank">
                          <Eye className="h-3 w-3 mr-1" />
                          Ver
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/admin/blog?edit=${post.id}`}>
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
