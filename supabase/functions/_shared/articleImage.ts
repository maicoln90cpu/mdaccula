/**
 * Fase 2 da correção de "geração por tema" (R-048, docs/TESTING.md): artigos
 * gerados em `mode: 'source_article'` (reescrita fiel de 1 matéria real)
 * nasciam sem capa — a imagem por IA (Lovable Gateway) nunca fazia sentido
 * editorial pra uma reescrita fiel de notícia real, então o admin pediu pra
 * nunca usar IA aqui. Resolve uma imagem real em 2 camadas, nessa ordem:
 * 1) og:image/twitter:image da própria matéria original (mesma técnica já
 *    usada em `fetch-link-metadata/index.ts`, sem custo de API — fetch puro).
 * 2) Busca de imagem via Firecrawl (`sources: ["images"]`, mesma
 *    FIRECRAWL_API_KEY já configurada — sem precisar de uma chave nova do
 *    Google) pelo tema do artigo, só se a camada 1 não encontrar nada.
 * Se as duas falharem, retorna null — o post fica sem `image_url`, caindo
 * no placeholder padrão do site (nunca gera nada artificialmente).
 */

import { fetchWithTimeout } from "./index.ts";
import { uploadBytesToBunny } from "./bunnyUploadBytes.ts";

export interface ResolvedArticleImage {
  url: string;
  credit: string;
}

const OG_IMAGE_REGEX = /<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i;

export function extractOgImageFromHtml(html: string, pageUrl: string): string | null {
  const match = html.match(OG_IMAGE_REGEX);
  if (!match) return null;

  let imageUrl = match[1];
  if (!imageUrl.startsWith("http")) {
    try {
      imageUrl = new URL(imageUrl, pageUrl).toString();
    } catch {
      return null;
    }
  }
  return imageUrl;
}

export async function fetchOriginalArticleImage(articleUrl: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(
      articleUrl,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; MDAcculaBot/1.0)" }, redirect: "follow" },
      timeoutMs
    );
    if (!response.ok) return null;
    const html = await response.text();
    return extractOgImageFromHtml(html, response.url || articleUrl);
  } catch {
    return null;
  }
}

export interface FirecrawlImageResult {
  imageUrl: string;
  title: string;
  pageUrl: string;
}

export function parseFirecrawlImageResults(data: unknown): FirecrawlImageResult[] {
  const images = (data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const rawImages = images?.images;
  if (!Array.isArray(rawImages)) return [];

  const results: FirecrawlImageResult[] = [];
  for (const item of rawImages) {
    const r = item as Record<string, unknown>;
    const imageUrl = typeof r.imageUrl === "string" ? r.imageUrl : "";
    if (!imageUrl) continue;
    results.push({
      imageUrl,
      title: typeof r.title === "string" ? r.title : "",
      pageUrl: typeof r.url === "string" ? r.url : "",
    });
  }
  return results;
}

export async function searchImageWithFirecrawl(
  query: string,
  apiKey: string,
  timeoutMs = 15000
): Promise<FirecrawlImageResult | null> {
  try {
    const response = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/search",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, sources: ["images"], limit: 3 }),
      },
      timeoutMs
    );
    if (!response.ok) return null;
    const data = await response.json();
    const results = parseFirecrawlImageResults(data);
    return results[0] || null;
  } catch {
    return null;
  }
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function downloadAndRehostImage(
  imageUrl: string,
  pathPrefix: string,
  timeoutMs = 15000
): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(
      imageUrl,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; MDAcculaBot/1.0)" } },
      timeoutMs
    );
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "image/jpeg";
    const ext = EXTENSION_BY_CONTENT_TYPE[contentType] || "jpg";
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) return null;

    const fileName = `${pathPrefix}-${Date.now()}.${ext}`;
    const { url } = await uploadBytesToBunny(buffer, `event-images/${fileName}`, contentType);
    return url;
  } catch {
    return null;
  }
}

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Resolve a imagem de capa de um artigo `mode: 'source_article'`, em 2
 * camadas, nunca IA — ver comentário do módulo. Retorna null se as duas
 * falharem (sem imagem, cai no placeholder padrão do site).
 */
export async function resolveArticleImage(
  articleUrl: string,
  sourceName: string,
  searchTerm: string,
  firecrawlApiKey: string
): Promise<ResolvedArticleImage | null> {
  const originalImageUrl = await fetchOriginalArticleImage(articleUrl);
  if (originalImageUrl) {
    const rehosted = await downloadAndRehostImage(originalImageUrl, "topic-original");
    if (rehosted) {
      return { url: rehosted, credit: `Imagem: ${sourceName}` };
    }
  }

  const searchResult = await searchImageWithFirecrawl(searchTerm, firecrawlApiKey);
  if (searchResult) {
    const rehosted = await downloadAndRehostImage(searchResult.imageUrl, "topic-search");
    if (rehosted) {
      const creditSource = extractHostname(searchResult.pageUrl) || searchResult.title || "web";
      return { url: rehosted, credit: `Imagem: ${creditSource}` };
    }
  }

  return null;
}
