import {
  handleCorsPreFlight,
  jsonError,
  jsonSuccess,
} from "../_shared/index.ts";
import { searchWithFirecrawl } from "../_shared/firecrawlSearch.ts";

// Preview leve (sem chamada de IA) do que `generate-blog-post-from-topic`
// encontraria pra um termo de busca. Usado pelo botão "Ver fontes" na aba de
// Sugestões, pra mostrar ao admin — antes de gastar uma geração completa —
// quais páginas a busca aberta na web retornaria para aquele termo. Isso não
// tem relação com o catálogo de `event_sources` (ver R-031 em firecrawlSearch.ts).
const SEARCH_TIMEOUT_MS = 30000;
const MAX_SOURCES = 5;

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (!query) {
      return jsonError('Informe um termo de busca (ex: "DJ Chus")', 400);
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return jsonError("FIRECRAWL_API_KEY não configurada", 500);
    }

    const results = await searchWithFirecrawl(query, FIRECRAWL_API_KEY, MAX_SOURCES, SEARCH_TIMEOUT_MS);

    return jsonSuccess({
      success: true,
      sources: results.map((r) => ({ title: r.title, url: r.url })),
    });
  } catch (error) {
    console.error("[preview-topic-sources] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return jsonError(`Falha ao buscar fontes: ${message}`, 502);
  }
});
