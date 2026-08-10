/**
 * Fase 1 da correção de "geração por tema" (ver R-048 em docs/TESTING.md):
 * até aqui, nenhuma fonte cadastrada em `event_sources` era raspada por
 * matéria individual — só a homepage inteira, cujo `onlyMainContent` é
 * essencialmente branding/navegação. Este módulo descobre links de matérias
 * individuais dentro do domínio de uma fonte, filtra os que não são notícia
 * (navegação, categoria, redes sociais, já usados antes) e escolhe 1 pra
 * reescrita fiel — usado só pelo caminho 100% automático (`auto-article-cron`).
 */

export interface SourceRef {
  url: string;
  name: string;
}

// Domínios de redes sociais/streaming que uma página de notícias costuma
// linkar no rodapé/header — nunca são "a matéria em si".
const NON_ARTICLE_HOSTNAMES = [
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'linkedin.com',
  'wa.me',
  'api.whatsapp.com',
  'soundcloud.com',
  'spotify.com',
  'music.apple.com',
];

// Caminhos que são estrutura do site (listagem, institucional, utilitário),
// não uma matéria específica.
const NON_ARTICLE_PATH_PATTERNS = [
  /^\/?$/, // raiz
  /\/(tag|tags|categoria|category|page|pagina|author|autor|search|busca|feed|wp-admin|wp-json|wp-content)(\/|$)/i,
  /\/(sobre|about|contato|contact|anuncie|advertise|privacidade|privacy-policy|termos|terms|newsletter|assine|assinatura)(\/?$)/i,
];

// R-048 (achado em produção, 09/08/2026): a fonte "Play BPM" tem um link de
// menu pra "/noticias/" na própria homepage — passava pelos filtros acima
// (não é raiz, não bate nenhum padrão institucional/categoria genérico) e
// era escolhido como "a matéria". Na prática é a página de LISTAGEM de
// notícias, não uma notícia específica — a IA corretamente recusou gerar
// (insufficientSources), mas o resultado pro admin foi "gerei e não deu
// certo" (nenhum artigo saiu). Uma URL com um único segmento de path que
// bate um nome comum de seção/listagem (pt-BR e en) é sempre índice, nunca
// artigo — mesmo raciocínio de NON_ARTICLE_PATH_PATTERNS, só que dependente
// da profundidade do path (silo1) em vez de aparecer em qualquer profundidade.
const LISTING_INDEX_SEGMENTS = new Set([
  'noticias', 'noticia', 'news', 'blog', 'artigos', 'materias', 'materia',
  'posts', 'colunas', 'coluna', 'editorial', 'reviews', 'agenda', 'eventos',
  'cobertura', 'pauta', 'ultimas', 'ultimas-noticias', 'home', 'destaques',
]);

function isListingIndexPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 1 && LISTING_INDEX_SEGMENTS.has(segments[0].toLowerCase());
}

function isLikelyArticleUrl(candidateUrl: string, sourceHostname: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname.replace(/^www\./, '');
  if (hostname !== sourceHostname) return false; // só matéria do próprio domínio da fonte

  if (NON_ARTICLE_HOSTNAMES.some((h) => hostname === h || hostname.endsWith(`.${h}`))) return false;
  if (NON_ARTICLE_PATH_PATTERNS.some((re) => re.test(parsed.pathname))) return false;
  if (isListingIndexPath(parsed.pathname)) return false;

  return true;
}

function normalizeForDedupe(url: string): string {
  return url.replace(/\/$/, '').toLowerCase();
}

/**
 * Filtra os links brutos de uma página de listagem/homepage pra só as
 * matérias individuais plausíveis do próprio domínio, excluindo URLs já
 * usadas antes (histórico de `ai_generated_posts.source_urls`). Preserva a
 * ordem de aparição — o primeiro candidato é o mais próximo do topo da
 * listagem original.
 */
export function discoverArticleUrls(source: SourceRef, rawLinks: string[], excludeUrls: string[] = []): string[] {
  let sourceHostname: string;
  try {
    sourceHostname = new URL(source.url).hostname.replace(/^www\./, '');
  } catch {
    return [];
  }

  const excludeSet = new Set(excludeUrls.map(normalizeForDedupe));
  const seen = new Set<string>();
  const result: string[] = [];

  for (const link of rawLinks) {
    if (typeof link !== 'string' || !isLikelyArticleUrl(link, sourceHostname)) continue;
    const normalized = normalizeForDedupe(link);
    if (excludeSet.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(link);
  }

  return result;
}

/** Mais próximo do topo da listagem = mais recente/mais em destaque na fonte. */
export function pickArticleUrl(candidates: string[]): string | null {
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Segundo hop de descoberta: quando a raiz da fonte só linka pra páginas de
 * listagem (ex.: menu com "/noticias/"), essas páginas de listagem em si —
 * não uma matéria — costumam ser onde as matérias individuais de fato estão
 * linkadas. Retorna as URLs de listagem do próprio domínio encontradas nos
 * links brutos, pra serem raspadas em seguida como uma segunda página de
 * origem (ver auto-article-cron, Etapa 1).
 */
export function findListingIndexUrls(source: SourceRef, rawLinks: string[]): string[] {
  let sourceHostname: string;
  try {
    sourceHostname = new URL(source.url).hostname.replace(/^www\./, '');
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const link of rawLinks) {
    if (typeof link !== 'string') continue;
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      continue;
    }
    const hostname = parsed.hostname.replace(/^www\./, '');
    if (hostname !== sourceHostname || !isListingIndexPath(parsed.pathname)) continue;

    const normalized = normalizeForDedupe(link);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(link);
  }

  return result;
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

/** Raspa uma página de listagem/homepage só pra extrair os links — sem markdown. */
export async function fetchSourceLinks(sourceUrl: string, apiKey: string, timeoutMs = 15000): Promise<string[]> {
  const response = await fetchWithTimeout(
    'https://api.firecrawl.dev/v1/scrape',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: sourceUrl, formats: ['links'], onlyMainContent: false }),
    },
    timeoutMs
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl scrape (links) HTTP ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const links = data?.data?.links;
  return Array.isArray(links) ? links.filter((l: unknown): l is string => typeof l === 'string') : [];
}

const ARTICLE_CONTENT_MAX_LENGTH = 8000;

/** Raspa o conteúdo completo de UMA matéria específica (não uma listagem). */
export async function scrapeArticleContent(
  articleUrl: string,
  apiKey: string,
  timeoutMs = 15000
): Promise<{ markdown: string } | null> {
  const response = await fetchWithTimeout(
    'https://api.firecrawl.dev/v1/scrape',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: articleUrl, formats: ['markdown'], onlyMainContent: true, waitFor: 1500 }),
    },
    timeoutMs
  );

  if (!response.ok) return null;

  const data = await response.json();
  const markdown = data?.data?.markdown;
  if (typeof markdown !== 'string' || !markdown.trim()) return null;

  return { markdown: markdown.substring(0, ARTICLE_CONTENT_MAX_LENGTH) };
}
