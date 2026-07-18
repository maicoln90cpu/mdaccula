import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "./button";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./command";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export const SearchBar = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Debounce the search query by 300ms
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data: quickResults, isLoading } = useQuery({
    queryKey: ["quick-search", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 3) return [];
      const { data } = await supabase.rpc("search_blog_posts", {
        search_query: debouncedQuery,
        limit_results: 5,
        offset_results: 0,
      });
      return data || [];
    },
    enabled: debouncedQuery.length >= 3,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (slug: string) => {
    navigate(`/blog/${slug}`);
    setOpen(false);
    setQuery("");
  };

  const handleSearch = () => {
    if (query.trim()) {
      navigate(`/busca?q=${encodeURIComponent(query)}`);
      setOpen(false);
      setQuery("");
    }
  };

  // Determine what to show based on query length and debounce state
  const showLoading = query.length >= 3 && query !== debouncedQuery;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline">Buscar...</span>
        <kbd className="hidden md:inline-flex px-2 py-1 text-xs bg-muted rounded">
          Ctrl+K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar posts, eventos..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length < 3 ? (
            <CommandEmpty>Digite pelo menos 3 caracteres...</CommandEmpty>
          ) : showLoading || isLoading ? (
            <CommandEmpty>Buscando...</CommandEmpty>
          ) : (
            <>
              {quickResults && quickResults.length > 0 ? (
                <CommandGroup heading="Resultados">
                  {quickResults.map((result) => (
                    <CommandItem
                      key={result.id}
                      onSelect={() => handleSelect(result.slug)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{result.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {result.category}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                  <CommandItem onSelect={handleSearch}>
                    <span className="text-primary">
                      Ver todos os resultados →
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : (
                <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
