import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SEOHead } from "@/components/SEOHead";
import { PageHeader } from "@/components/ui/page-header";

const CATEGORIES = [
  "Cena SP",
  "Techno",
  "House",
  "Trance",
  "Bass Music",
  "Festivais",
  "DJs",
  "Entrevistas",
];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category");

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", query, category],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_blog_posts", {
        search_query: query,
        category_filter: category || null,
        limit_results: 20,
        offset_results: 0,
      });
      if (error) throw error;
      return data;
    },
    enabled: query.length > 2,
  });

  const handleCategoryChange = (value: string) => {
    if (value === "all") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", value);
    }
    setSearchParams(searchParams);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <SEOHead
          title={`Busca: ${query} | MD'Accula`}
          description={`Resultados da busca por "${query}" no blog MD'Accula`}
          url={`/busca?q=${query}`}
        />
        <Navigation />
        <main id="main-content" className="pt-16">
          <PageHeader
            title={`Resultados para "${query}"`}
            subtitle={`${results?.length || 0} resultados encontrados`}
            breadcrumb={[{ label: "Home", href: "/" }, { label: "Busca" }]}
            variant="plain"
            align="center"
          />
          <div className="container mx-auto px-4 py-8">

            {/* Filtros */}
            <div className="mb-6 flex gap-4">
              <Select value={category || "all"} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Resultados */}
            <div className="space-y-6">
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => <Skeleton key={i} className="h-32" />)
              ) : query.length < 3 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Digite pelo menos 3 caracteres para buscar
                  </p>
                </Card>
              ) : results && results.length > 0 ? (
                results.map((result: any) => (
                  <Card
                    key={result.id}
                    className="overflow-hidden hover:shadow-lg transition"
                  >
                    <a
                      href={`/blog/${result.slug}`}
                      className="flex flex-col md:flex-row"
                    >
                      {result.image_url && (
                        <div className="md:w-48 h-48 md:h-auto flex-shrink-0 bg-muted/20 flex items-center justify-center rounded-lg overflow-hidden">
                          <OptimizedImage
                            src={result.image_url}
                            alt={result.title}
                            className="max-w-full max-h-full"
                            objectFit="contain"
                          />
                        </div>
                      )}
                      <div className="p-6 flex-1">
                        <Badge className="mb-3">{result.category}</Badge>
                        <h3 className="text-2xl font-bold mb-2 hover:text-primary transition">
                          {result.title}
                        </h3>
                        {result.excerpt && (
                          <p className="text-muted-foreground mb-4 line-clamp-2">
                            {result.excerpt}
                          </p>
                        )}
                        <div
                          className="text-sm text-muted-foreground mb-4"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.headline || '') }}
                        />
                        <span className="text-sm text-primary font-medium">
                          Leia mais →
                        </span>
                      </div>
                    </a>
                  </Card>
                ))
              ) : (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhum resultado encontrado para "{query}"
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Tente usar palavras-chave diferentes ou remova os filtros
                  </p>
                </Card>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}
