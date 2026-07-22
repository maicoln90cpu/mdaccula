/**
 * Busca + scraping em uma chamada só via Firecrawl `/v1/search`. Usada por
 * generate-blog-post-from-topic (busca por tema manual) e pelo guardrail de
 * generate-blog-post-v2 (bloqueia geração de evento sem sinal real quando
 * nenhuma fonte é encontrada).
 *
 * Formato de resposta documentado: { success, data: { web: [{ title, url, markdown, metadata }] } }.
 * Faz parsing defensivo (também aceita `data` como array puro) porque a
 * Firecrawl já mudou esse formato entre versões da API.
 */

export interface FirecrawlSearchResult {
  title: string;
  url: string;
  content: string;
}

const MAX_CONTENT_LENGTH = 2000;

// R-025: busca livre pra termos de música/artista (ex.: "dub techno", "Alok")
// naturalmente traz páginas de player/playlist/perfil como resultado mais
// relevante — não fontes jornalísticas. Isso já apareceu no modal "Fontes e
// origem do artigo" como se fosse uma fonte real cadastrada, quando na
// verdade nem passa perto do catálogo em `event_sources`. Bloqueadas aqui
// (na busca compartilhada) pra beneficiar generate-blog-post-from-topic E o
// guardrail de generate-blog-post-v2 ao mesmo tempo.
const BLOCKED_HOSTNAMES = [
  "youtube.com",
  "youtu.be",
  "spotify.com",
  "music.apple.com",
  "soundcloud.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "twitter.com",
  "x.com",
];

function isBlockedSource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_HOSTNAMES.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchWithFirecrawl(
  query: string,
  apiKey: string,
  limit: number,
  timeoutMs: number = 30000
): Promise<FirecrawlSearchResult[]> {
  const response = await fetchWithTimeout('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
    }),
  }, timeoutMs);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl search HTTP ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const rawResults: unknown[] = Array.isArray(data?.data?.web)
    ? data.data.web
    : Array.isArray(data?.data)
      ? data.data
      : [];

  const results: FirecrawlSearchResult[] = [];
  for (const item of rawResults) {
    const r = item as Record<string, unknown>;
    const markdown = typeof r.markdown === 'string' ? r.markdown : '';
    const metadata = (r.metadata as Record<string, unknown>) || {};
    const url = (typeof r.url === 'string' && r.url) || (typeof metadata.sourceURL === 'string' && metadata.sourceURL) || '';
    const title = (typeof r.title === 'string' && r.title) || (typeof metadata.title === 'string' && metadata.title) || url;
    if (markdown && url && !isBlockedSource(url)) {
      results.push({ title: String(title), url: String(url), content: markdown.substring(0, MAX_CONTENT_LENGTH) });
    }
  }
  return results;
}
