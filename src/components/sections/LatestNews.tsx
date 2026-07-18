import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useScrollReveal } from "@/hooks";
import { cn } from "@/lib";
import SectionHeading from "@/components/sections/SectionHeading";

const AUTOPLAY_INTERVAL_MS = 4500;

interface LatestPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
  image_url: string | null;
  views: number;
  likes: number;
  created_at: string;
  published_at: string | null;
}

const estimateReadTime = (excerpt: string | null) => {
  if (!excerpt) return 5;
  return Math.max(3, Math.ceil((excerpt.length / 100) * 5));
};

const NewsClip = ({ post, index }: { post: LatestPost; index: number }) => {
  const { ref, isVisible } = useScrollReveal<HTMLAnchorElement>();
  const readTime = estimateReadTime(post.excerpt);

  return (
    <Link
      to={`/blog/${post.slug}`}
      ref={ref}
      className={cn(
        "group block rounded-r-md overflow-hidden bg-card border border-border border-l-4 border-l-secondary",
        "transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:border-l-accent",
        "hover:shadow-[0_16px_34px_hsl(220_25%_0%/0.45),0_0_24px_hsl(var(--accent)/0.18)]",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="relative aspect-video overflow-hidden bg-muted/20">
        <OptimizedImage
          src={post.image_url || "/placeholder.svg"}
          alt={post.title}
          className="w-full h-full transition-transform duration-500 group-hover:scale-105"
          objectFit="cover"
          priority={index === 0}
          variant="thumb"
        />
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-2 text-xs font-mono uppercase tracking-wide">
          <span className="text-secondary-glow">{post.category}</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {new Date(post.published_at ?? post.created_at).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-2">{post.excerpt}</p>
        <p className="text-xs text-muted-foreground">{readTime} min de leitura</p>
      </div>
    </Link>
  );
};

const LatestNews = () => {
  const [api, setApi] = useState<CarouselApi>();
  const isHovering = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!api || prefersReducedMotion) return;

    const interval = window.setInterval(() => {
      if (isHovering.current) return;
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
      }
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [api, prefersReducedMotion]);

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["latest-news"],
    queryFn: async (): Promise<LatestPost[]> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, category, image_url, views, likes, created_at, published_at")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <SectionHeading title="Últimas Notícias" viewAllHref="/blog" viewAllLabel="Ver blog" />
          <div className="flex gap-6 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="basis-full sm:basis-1/2 lg:basis-1/3 shrink-0 rounded-r-md overflow-hidden bg-card border border-border border-l-4 border-l-secondary"
              >
                <Skeleton className="aspect-video w-full" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">Erro ao carregar notícias</p>
        </div>
      </section>
    );
  }

  if (!posts) {
    return null;
  }

  return (
    <ErrorBoundary>
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <SectionHeading title="Últimas Notícias" viewAllHref="/blog" viewAllLabel="Ver blog" />

          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                Nenhuma notícia publicada ainda. Em breve novidades!
              </p>
            </div>
          ) : (
            <Carousel
              opts={{ align: "start", loop: false }}
              setApi={setApi}
              className="relative"
              onMouseEnter={() => {
                isHovering.current = true;
              }}
              onMouseLeave={() => {
                isHovering.current = false;
              }}
            >
              <CarouselContent className="-ml-6">
                {posts.map((post, index) => (
                  <CarouselItem key={post.id} className="pl-6 basis-full sm:basis-1/2 lg:basis-1/3">
                    <NewsClip post={post} index={index} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2 border-primary/40 bg-background/80 backdrop-blur hover:border-primary hover:shadow-[0_0_16px_hsl(var(--primary)/0.4)]" />
              <CarouselNext className="right-2 border-primary/40 bg-background/80 backdrop-blur hover:border-primary hover:shadow-[0_0_16px_hsl(var(--primary)/0.4)]" />
            </Carousel>
          )}
        </div>
      </section>
    </ErrorBoundary>
  );
};

export default LatestNews;
