import { discoverArticleUrls, fetchSourceLinks, findListingIndexUrls, type SourceRef } from "../_shared/sourceArticlePicker.ts";

/**
 * Descobre candidatos novos numa fonte, com o mesmo 2º hop do auto-article-cron.
 * Nunca lança — falha de rede/scrape vira 0 candidatos, tratado no chamador
 * como "fonte não verificável agora" em vez de derrubar a verificação inteira.
 */
export async function countNewCandidates(source: SourceRef, usedUrls: string[], firecrawlApiKey: string): Promise<number> {
  try {
    const links = await fetchSourceLinks(source.url, firecrawlApiKey);
    let candidates = discoverArticleUrls(source, links, usedUrls);

    if (candidates.length === 0) {
      const listingUrls = findListingIndexUrls(source, links);
      for (const listingUrl of listingUrls.slice(0, 2)) {
        const deeperLinks = await fetchSourceLinks(listingUrl, firecrawlApiKey);
        candidates = discoverArticleUrls(source, deeperLinks, usedUrls);
        if (candidates.length > 0) break;
      }
    }

    return candidates.length;
  } catch (error) {
    console.error(`[verify-sources-weekly] Falha ao descobrir links de "${source.name}":`, error);
    return 0;
  }
}
