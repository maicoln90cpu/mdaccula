/**
 * Regressão — artigos gerados por "Sugestões"/"Gerar por Tema"
 * (generate-blog-post-from-topic, via a busca compartilhada em
 * _shared/firecrawlSearch.ts) citavam páginas de Wikipédia/IMDb/bases de
 * filme como se fossem "fonte real" para nomes ambíguos de DJ/produtor
 * (ex.: "DJ Chus" → Wikipédia, "Anna de Lucc" → ficha de filme). O blocklist
 * de domínios (R-025) só cobria streaming/redes sociais, não enciclopédias
 * nem bases de filme/TV — daí esses resultados passavam direto pro prompt
 * da IA como "FONTES ENCONTRADAS" e eram citados no artigo final.
 *
 * Ver R-031 em supabase/functions/_shared/firecrawlSearch.ts.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — firecrawlSearch bloqueia enciclopédias/bases de filme irrelevantes', () => {
  it('BLOCKED_HOSTNAMES inclui os domínios do incidente DJ Chus/Anna de Lucc', () => {
    const content = read('supabase/functions/_shared/firecrawlSearch.ts');
    const blockMatch = content.match(/const BLOCKED_HOSTNAMES = \[([\s\S]*?)\];/);
    expect(blockMatch, 'Não encontrei BLOCKED_HOSTNAMES em firecrawlSearch.ts.').toBeTruthy();

    const blockedList = blockMatch![1];
    for (const domain of [
      'wikipedia.org',
      'wikimedia.org',
      'wikiwand.com',
      'imdb.com',
      'themoviedb.org',
      'rottentomatoes.com',
      'letterboxd.com',
      'fandom.com',
    ]) {
      expect(
        blockedList,
        `Domínio "${domain}" saiu do blocklist — reabre o bug de fontes irrelevantes/enganosas.`
      ).toContain(domain);
    }
  });
});
