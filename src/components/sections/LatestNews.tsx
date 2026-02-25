import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Calendar, ArrowRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/OptimizedImage";
import { IMAGE_PRESETS } from "@/lib/imageUtils";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const LatestNews = () => {
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['latest-news'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 hero-text">Últimas Notícias</h2>
            <p className="text-xl text-muted-foreground">Fique por dentro do mundo da música eletrônica</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="card-hover">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">Erro ao carregar notícias</p>
        </div>
      </section>
    );
  }
  
  // Aguarda dados carregarem
  if (!posts) {
    return null;
  }
  
  const calculateReadTime = (content: string) => {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  return (
    <ErrorBoundary>
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 hero-text">
              Últimas Notícias
            </h2>
            <p className="text-xl text-muted-foreground">
              Fique por dentro do mundo da música eletrônica
            </p>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                Nenhuma notícia publicada ainda. Em breve novidades!
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                {posts.map((item, index) => {
                  const readTime = item.content ? calculateReadTime(item.content) : 5;
                  return (
                    <Card key={item.id} className="card-hover flex flex-col h-full min-h-[450px] sm:min-h-[500px]">
                      <div className="relative aspect-video overflow-hidden bg-muted/20">
                        <OptimizedImage
                          src={item.image_url || '/placeholder.svg'}
                          alt={item.title}
                          className="w-full h-full"
                          objectFit="contain"
                          priority={index === 0}
                          transformWidth={IMAGE_PRESETS.card.width}
                          transformQuality={IMAGE_PRESETS.card.quality}
                        />
                      </div>

                      <CardHeader className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs sm:text-sm">{item.category}</Badge>
                          <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                            <span className="truncate">
                              {item.published_at 
                                ? new Date(item.published_at).toLocaleDateString('pt-BR')
                                : new Date(item.created_at).toLocaleDateString('pt-BR')
                              }
                            </span>
                          </div>
                        </div>
                        <CardTitle className="text-lg sm:text-xl line-clamp-2 hover:text-primary transition-colors break-words">
                          {item.title}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="flex-grow p-4 sm:p-6 pt-0">
                        <p className="text-sm sm:text-base text-muted-foreground line-clamp-3 leading-relaxed">
                          {item.excerpt}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {readTime} min de leitura
                        </p>
                      </CardContent>

                      <CardFooter className="p-4 sm:p-6 pt-0">
                        <Button variant="ghost" className="w-full group min-h-[44px] text-base" asChild>
                          <Link to={`/blog/${item.slug}`}>
                            Ler mais
                            <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>

              <div className="text-center">
                <Button size="lg" asChild>
                  <Link to="/blog">
                    Ver todas as notícias
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </ErrorBoundary>
  );
};

export default LatestNews;
