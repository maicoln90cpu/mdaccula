import { useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Eye, Heart, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { ShareButtons } from "@/components/ShareButtons";
import { LikeButton } from "@/components/blog/LikeButton";

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category: string;
  image_url: string | null;
  views: number;
  likes: number;
  published: boolean;
  created_at: string;
  author_id: string | null;
}

const fetchBlogPost = async (slug: string): Promise<BlogPostData | null> => {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }
  return data;
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, error } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: () => fetchBlogPost(slug!),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  });

  // Track view on page load (only once per post)
  useEffect(() => {
    if (post?.id) {
      supabase.functions.invoke("track-view", {
        body: { postId: post.id },
      });
    }
  }, [post?.id]);

  const formatContent = useMemo(() => {
    if (!post?.content) return "";
    
    const content = post.content;
    // Se já tem HTML, retorna direto
    if (content.includes("<p>") || content.includes("<h2>")) {
      return content;
    }

    // Converte texto puro em HTML
    return content
      .split("\n\n")
      .map((block) => {
        // Detecta títulos (linhas com emojis ou ALL CAPS)
        if (block.match(/^[🎶💥📍💡🔊🏁👉].+/) || block.match(/^[A-Z\s]{10,}$/)) {
          return `<h2 class="text-2xl font-bold mt-6 mb-4">${block}</h2>`;
        }
        // Parágrafos normais
        return `<p class="mb-4">${block.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }, [post?.content]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Eventos":
        return "bg-primary/20 text-primary border-primary/30";
      case "Cena SP":
        return "bg-secondary/20 text-secondary border-secondary/30";
      case "Festivais":
        return "bg-accent/20 text-accent border-accent/30";
      case "História":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "Guias":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Entrevistas":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <main className="pt-16 flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Carregando...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <main className="pt-16 container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl font-bold mb-4">Post não encontrado</h1>
          <p className="text-muted-foreground mb-8">O post que você está procurando não existe ou foi removido.</p>
          <Button asChild>
            <Link to="/blog">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Blog
            </Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const currentUrl = `https://mdaccula.com/blog/${slug}`;

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>{`${post.title} - MD Accula`}</title>
        <meta name="description" content={post.excerpt || post.content?.substring(0, 160)} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt || post.content?.substring(0, 160)} />
        <meta property="og:image" content={post.image_url || ""} />
        <meta property="og:url" content={currentUrl} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.excerpt || post.content?.substring(0, 160)} />
        <meta name="twitter:image" content={post.image_url || ""} />
        <link rel="canonical" href={currentUrl} />
        {/* Preload post image for LCP optimization */}
        {post.image_url && (
          <link rel="preload" as="image" href={getOptimizedImageUrl(post.image_url)} fetchPriority="high" />
        )}
      </Helmet>
      <Navigation />

      <main className="pt-16">
        {/* Header */}
        <section className="py-8 sm:py-12 bg-gradient-to-r from-primary/20 to-accent/20">
          <div className="container mx-auto px-4">
            <Button asChild variant="ghost" className="mb-4 sm:mb-6 min-h-[44px]">
              <Link to="/blog">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Blog
              </Link>
            </Button>

            <div className="max-w-4xl mx-auto">
              <Badge className={`text-xs sm:text-sm ${getCategoryColor(post.category)}`}>{post.category}</Badge>

              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mt-3 sm:mt-4 mb-4 sm:mb-6 hero-text leading-tight">{post.title}</h1>

              <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span>MDAccula</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span>{new Date(post.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex items-center">
                  <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span>{post.views} visualizações</span>
                </div>
                <div className="flex items-center">
                  <Heart className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span>{post.likes} curtidas</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Image */}
        {post.image_url && (
          <section className="py-6 sm:py-8 bg-background">
            <div className="container mx-auto px-4">
              <div className="max-w-xl mx-auto bg-muted/20 rounded-lg overflow-hidden">
                <img 
                  src={getOptimizedImageUrl(post.image_url)} 
                  alt={post.title} 
                  className="w-full h-auto max-h-[42vh] object-contain rounded-lg mx-auto" 
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
            </div>
          </section>
        )}

        {/* Content */}
        <section className="py-12 bg-background">
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto">
              <CardContent className="p-8 md:p-12">
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatContent) }}
                />
              </CardContent>
            </Card>

            {/* Like and Share Section */}
            <div className="max-w-4xl mx-auto mt-6 sm:mt-8">
              <Card className="card-hover">
                <CardContent className="p-4 sm:p-6">
                  <LikeButton postId={post.id} initialLikes={post.likes} />
                  <div className="flex justify-end">
                    <ShareButtons
                      url={`/blog/${post.slug}`}
                      title={post.title}
                      description={post.excerpt || undefined}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default BlogPost;
