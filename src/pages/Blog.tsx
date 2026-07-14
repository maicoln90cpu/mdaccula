import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { SEOHead } from "@/components/SEOHead";
import { StructuredData } from "@/components/StructuredData";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator } from
"@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, User, Search, ArrowRight, Eye, Heart, Rss } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious } from
"@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import djImage from "@/assets/dj-performance.jpg";
import { getOptimizedImageUrl, handleImageFallback } from "@/lib/imageUtils";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
  image_url: string | null;
  views: number;
  likes: number;
  created_at: string;
  published_at?: string | null;
}

interface PaginatedResult {
  posts: BlogPost[];
  featuredPost: BlogPost | null;
  total: number;
}

const PAGE_SIZE = 9;

// Single consolidated fetch function for both featured post and paginated list
const fetchBlogPostsWithFeatured = async (
page: number,
category: string,
searchTerm: string)
: Promise<PaginatedResult> => {
  // Build base query
  let query = supabase.
  from("blog_posts").
  select("id, title, slug, excerpt, category, image_url, views, likes, created_at, published_at", { count: "exact" }).
  eq("published", true);

  // Apply category filter
  if (category !== "Todos") {
    query = query.eq("category", category);
  }

  // Apply search filter
  if (searchTerm) {
    query = query.or(`title.ilike.%${searchTerm}%,excerpt.ilike.%${searchTerm}%`);
  }

  // For page 1, fetch PAGE_SIZE + 1 to include featured post
  // For other pages, fetch normally but offset accounts for featured post
  const isFirstPage = page === 1;
  const limit = isFirstPage ? PAGE_SIZE + 1 : PAGE_SIZE;
  const offset = isFirstPage ? 0 : (page - 1) * PAGE_SIZE;

  const { data, error, count } = await query.
  order("created_at", { ascending: false }).
  range(offset, offset + limit - 1);

  if (error) throw error;

  const allPosts = data || [];
  const totalCount = count || 0;

  // Extract featured post (first post on page 1)
  const featuredPost = isFirstPage && allPosts.length > 0 ? allPosts[0] : null;

  // For page 1, exclude the featured post from the grid
  // For other pages, show all posts
  const posts = isFirstPage && featuredPost ? allPosts.slice(1) : allPosts;

  return {
    posts,
    featuredPost,
    total: totalCount
  };
};

const Blog = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Buscar categorias dinâmicas do banco de dados
  const { data: dynamicCategories } = useQuery({
    queryKey: ["blog-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blog_posts").select("category").eq("published", true);

      if (error) throw error;

      const categoryCount = (data || []).reduce(
        (acc, post) => {
          acc[post.category] = (acc[post.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const sortedCategories = Object.entries(categoryCount).
      sort((a, b) => b[1] - a[1]).
      map(([category]) => category);

      return ["Todos", ...sortedCategories];
    },
    staleTime: 30 * 60 * 1000, // 30 min - categories rarely change
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const categories = dynamicCategories || ["Todos"];

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory]);

  // Single consolidated query for both featured and paginated posts
  const { data: blogData, isLoading } = useQuery({
    queryKey: ["blog-posts", currentPage, selectedCategory, debouncedSearch],
    queryFn: () => fetchBlogPostsWithFeatured(currentPage, selectedCategory, debouncedSearch),
    staleTime: 10 * 60 * 1000, // 10 min cache
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const posts = blogData?.posts || [];
  const featuredPost = blogData?.featuredPost || null;
  const totalPosts = blogData?.total || 0;

  // Calculate total pages (subtract 1 for featured post on first page)
  const effectiveTotal = featuredPost ? totalPosts - 1 : totalPosts;
  const totalPages = Math.ceil(effectiveTotal / PAGE_SIZE);

  // Skeleton components for loading state
  const BlogCardSkeleton = () =>
  <Card className="overflow-hidden h-full">
      <Skeleton className="aspect-video w-full" />
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center justify-between pt-4">
          <div className="flex gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex gap-4">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      </CardContent>
    </Card>;


  const BlogGridSkeleton = () =>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {Array.from({ length: 6 }).map((_, i) =>
    <BlogCardSkeleton key={i} />
    )}
    </div>;


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
      case "Cultura":
        return "bg-pink-500/20 text-pink-400 border-pink-500/30";
      case "Lançamentos":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      case "Tecnologia":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Produtores":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30";
    }
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newsletterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newsletterEmail)) {
      toast.error("Por favor, insira um email válido");
      return;
    }

    setNewsletterLoading(true);

    try {
      const { error } = await supabase.from("newsletter_subscribers").insert({
        email: newsletterEmail,
        source: "blog_footer"
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Este email já está cadastrado!");
        } else {
          throw error;
        }
      } else {
        toast.success("🎉 Inscrição realizada com sucesso!");
        setNewsletterEmail("");
      }
    } catch (error) {
      console.error("Newsletter error:", error);
      toast.error("Erro ao processar inscrição. Tente novamente.");
    } finally {
      setNewsletterLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Blog de Música Eletrônica - Techno e House"
        description="Fique por dentro das últimas notícias da cena eletrônica brasileira e mundial. Techno, house, festivais e eventos underground em São Paulo."
        keywords={[
        "blog música eletrônica",
        "notícias techno sp",
        "cena eletrônica brasil",
        "festivais techno 2025",
        "house music blog",
        "eventos underground sp"]
        }
        url="https://mdaccula.com/blog" />
      
      <StructuredData
        type="breadcrumb"
        data={{
          items: [
          { name: "Home", url: "https://mdaccula.com" },
          { name: "Blog", url: "https://mdaccula.com/blog" }]

        }} />
      

      <div className="min-h-screen">
        <Navigation />

        <main id="main-content" className="pt-16">
          {/* Breadcrumb */}
          <div className="container mx-auto px-4 pt-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Blog</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {/* Hero Section */}
          <section className="py-20 bg-gradient-to-r from-primary/20 to-accent/20">
            <div className="container mx-auto px-4 text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 hero-text">Blog</h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
                Fique por dentro de tudo que rola na cena eletrônica brasileira e mundial
              </p>
              <div className="flex justify-center">
                <Button variant="outline" asChild className="gap-2">
                  <a
                    href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blog-rss`}
                    target="_blank"
                    rel="noopener noreferrer">
                    
                    <Rss className="w-4 h-4" />
                    Feed RSS
                  </a>
                </Button>
              </div>
            </div>
          </section>

          {/* Search and Filters */}
          <section className="py-8 bg-card/50">
            <div className="container mx-auto px-4">
              <div className="flex flex-col gap-4">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar artigos..."
                    className="pl-10 h-12 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)} />
                  
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {categories.map((category) =>
                  <Badge
                    key={category}
                    variant="outline"
                    className={`cursor-pointer transition-colors min-h-[36px] px-4 text-sm ${
                    category === selectedCategory ?
                    "bg-primary/20 text-primary border-primary/30" :
                    "hover:bg-muted/50"}`
                    }
                    onClick={() => setSelectedCategory(category)}>
                    
                      {category}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Featured Post Skeleton or Content */}
          {isLoading ?
          <section className="py-12 bg-background">
              <div className="container mx-auto px-4">
                <Skeleton className="h-8 w-32 mb-6" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-lg overflow-hidden border border-border">
                  <Skeleton className="h-64 lg:h-80" />
                  <div className="p-6 md:p-8 space-y-4">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-4 pt-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="flex justify-between items-center pt-4">
                      <div className="flex gap-4">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                      <Skeleton className="h-10 w-28" />
                    </div>
                  </div>
                </div>
              </div>
            </section> :

          featuredPost &&
          <section className="py-8 bg-background">
                <div className="container mx-auto px-4">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 hero-text">Destaque</h2>

                  <Card className="card-hover overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                      <div className="relative overflow-hidden h-40 sm:h-48 md:h-56 lg:h-64 bg-muted/20">
                        <img
                      src={getOptimizedImageUrl(featuredPost.image_url) || djImage}
                      alt={featuredPost.title}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onError={(e) => handleImageFallback(e, djImage)} />
                    
                        <div className="absolute top-4 left-4">
                          <Badge className={`text-xs sm:text-sm ${getCategoryColor(featuredPost.category)}`}>
                            {featuredPost.category}
                          </Badge>
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 md:p-6 flex flex-col justify-center">
                        <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-3 text-primary break-words leading-tight">
                          {featuredPost.title}
                        </h3>

                        <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed line-clamp-3">
                          {featuredPost.excerpt}
                        </p>

                        <div className="flex items-center space-x-6 text-sm text-muted-foreground mb-4">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            MDAccula
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(featuredPost.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center">
                              <Eye className="w-4 h-4 mr-1" />
                              {featuredPost.views}
                            </div>
                            <div className="flex items-center">
                              <Heart className="w-4 h-4 mr-1" />
                              {featuredPost.likes}
                            </div>
                          </div>

                          <Button asChild size="sm">
                            <Link to={`/blog/${featuredPost.slug}`}>
                              Ler artigo
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </section>

          }

          {/* Posts Grid */}
          <section className="py-12 bg-darker-surface overflow-x-hidden">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold mb-8 hero-text">Últimos Artigos</h2>

              {isLoading ?
              <BlogGridSkeleton /> :
              posts.length === 0 && !featuredPost ?
              <p className="text-center text-muted-foreground">Nenhum post encontrado.</p> :

              <>
                  <div className="space-y-20 py-2">
                    {posts.map((post, index) => {
                    const isReversed = index % 2 === 1;
                    return (
                      <Link to={`/blog/${post.slug}`} key={post.id}>
                          <Card
                          className="card-hover group cursor-pointer overflow-hidden mx-0 py-0 my-[20px]"
                          style={{ animationDelay: `${index * 0.05}s` }}>
                          
                            <div className={`flex flex-row ${isReversed ? "flex-row-reverse" : ""}`}>
                              {/* Image lateral */}
                              <div className="relative flex-shrink-0 w-32 sm:w-40 md:w-48 min-h-[100px] bg-muted/20 overflow-hidden">
                                <img
                                src={getOptimizedImageUrl(post.image_url) || djImage}
                                alt={post.title}
                                className="w-full h-full object-contain"
                                loading="lazy"
                                decoding="async"
                                onError={(e) => handleImageFallback(e, djImage)} />
                              
                                <div className={`absolute top-2 ${isReversed ? "right-2" : "left-2"}`}>
                                  <Badge className={`text-[10px] px-1.5 py-0.5 ${getCategoryColor(post.category)}`}>
                                    {post.category}
                                  </Badge>
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0 mx-[10px] px-[20px]">
                                <div>
                                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                                    {post.title}
                                  </h3>
                                  <p className="text-sm sm:text-base text-muted-foreground line-clamp-2 mt-2 hidden sm:block">
                                    {post.excerpt || "Clique para ler mais..."}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-3">
                                    <span className="flex items-center">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      {new Date(post.created_at).toLocaleDateString("pt-BR")}
                                    </span>
                                    <span className="flex items-center">
                                      <Eye className="w-3 h-3 mr-1" />
                                      {post.views}
                                    </span>
                                    <span className="flex items-center">
                                      <Heart className="w-3 h-3 mr-1" />
                                      {post.likes}
                                    </span>
                                  </div>
                                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors hidden sm:block" />
                                </div>
                              </div>
                            </div>
                          </Card>
                        </Link>);

                  })}
                  </div>

                  {/* Smart Pagination */}
                  {totalPages > 1 &&
                <div className="mt-12 flex justify-center">
                      <Pagination>
                        <PaginationContent className="flex-wrap gap-1">
                          <PaginationItem>
                            <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                        
                          </PaginationItem>

                          {(() => {
                        const pages: (number | "ellipsis")[] = [];
                        if (totalPages <= 5) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          const start = Math.max(2, currentPage - 1);
                          const end = Math.min(totalPages - 1, currentPage + 1);
                          if (start > 2) pages.push("ellipsis");
                          for (let i = start; i <= end; i++) pages.push(i);
                          if (end < totalPages - 1) pages.push("ellipsis");
                          pages.push(totalPages);
                        }
                        return pages.map((p, idx) =>
                        p === "ellipsis" ?
                        <PaginationItem key={`e-${idx}`}>
                                  <PaginationEllipsis />
                                </PaginationItem> :

                        <PaginationItem key={p}>
                                  <PaginationLink
                            onClick={() => setCurrentPage(p)}
                            isActive={currentPage === p}
                            className="cursor-pointer">
                            
                                    {p}
                                  </PaginationLink>
                                </PaginationItem>

                        );
                      })()}

                          <PaginationItem>
                            <PaginationNext
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={
                          currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                          } />
                        
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                }
                </>
              }
            </div>
          </section>

          {/* Newsletter */}
          <section className="py-20 bg-background">
            <div className="container mx-auto px-4">
              <div className="max-w-xl mx-auto text-center">
                <h2 className="text-3xl font-bold mb-4 hero-text">Newsletter</h2>
                <p className="text-muted-foreground mb-8">Receba as últimas notícias diretamente no seu email</p>

                <form onSubmit={handleNewsletterSubmit} className="flex gap-4">
                  <Input
                    type="email"
                    placeholder="Seu melhor email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className="flex-1" />
                  
                  <Button type="submit" disabled={newsletterLoading}>
                    {newsletterLoading ? "Enviando..." : "Inscrever"}
                  </Button>
                </form>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>);

};

export default Blog;