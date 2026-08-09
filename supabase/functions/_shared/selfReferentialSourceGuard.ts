/**
 * Fase 0 da correção de "geração por tema" (ver docs/CHANGELOG.md, 2026-08):
 * generate-blog-suggestions raspa a homepage de uma fonte pra "inspirar"
 * sugestões, mas o `onlyMainContent` de uma homepage costuma ser só
 * branding/navegação — a única âncora "real, extraída literalmente" que
 * sobra é o próprio nome da marca da fonte. O searchQuery então vira ex.
 * "DJ Mag LA"/"Alataj"/"Wonderland in Rave", a busca aberta subsequente
 * (generate-blog-post-from-topic) devolve a própria homepage da fonte como
 * "fonte real", e o "artigo por tema" vira uma matéria institucional sobre
 * o veículo em vez de uma notícia real publicada nele. Confirmado com 4
 * rascunhos reais em produção com esse exato padrão.
 */

export interface SourceIdentity {
  name: string;
  url: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function domainLabelOf(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

/** true se o searchQuery for, ele mesmo, o nome ou o domínio de uma fonte cadastrada. */
export function isSelfReferentialSearchQuery(searchQuery: string, sources: SourceIdentity[]): boolean {
  const normalizedQuery = normalize(searchQuery);
  if (!normalizedQuery) return false;

  return sources.some((source) => {
    const normalizedName = normalize(source.name);
    if (normalizedName && normalizedQuery === normalizedName) return true;

    const domainLabel = normalize(domainLabelOf(source.url));
    return domainLabel.length > 2 && normalizedQuery === domainLabel;
  });
}
