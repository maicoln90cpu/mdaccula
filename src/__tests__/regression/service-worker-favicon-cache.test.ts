import { describe, it, expect, beforeAll } from 'vitest';

// Dynamic imports keep Node builtins out of Vite's browser build graph.
let readFileSync: typeof import('fs').readFileSync;

beforeAll(async () => {
  const fs = await import(/* @vite-ignore */ 'fs');
  readFileSync = fs.readFileSync;
});

/**
 * Regressão R-028 — favicon.ico ficava preso em cache errado indefinidamente.
 *
 * Causa raiz: public/service-worker.js tratava .ico como imagem (IMAGE_PATTERNS)
 * e servia via cacheFirst — a única estratégia do arquivo que NUNCA revalida
 * contra a rede. Um navegador que já tinha cacheado o ícone padrão do Lovable
 * (sobrescrito no arquivo em produção em algum momento, ver commit "Corrige
 * favicon revertido" de 14/07/2026) ficava preso nele para sempre, mesmo depois
 * do arquivo real já ter sido corrigido no servidor — parecendo "o favicon fica
 * revertendo sozinho" toda vez que o Service Worker trocava de versão e o
 * cache era parcialmente limpo.
 */
describe('Regressão R-028 — favicon.ico não pode entrar no cacheFirst sem revalidação', () => {
  it('IMAGE_PATTERNS do service worker exclui .ico', () => {
    const content = readFileSync(`${process.cwd()}/public/service-worker.js`, 'utf-8');

    const match = content.match(/const IMAGE_PATTERNS = \[\/(.+?)\/\]/);
    expect(match, 'IMAGE_PATTERNS não encontrado em public/service-worker.js').not.toBeNull();

    const pattern = new RegExp(match![1]);

    expect(
      pattern.test('/favicon.ico'),
      'favicon.ico não pode casar com IMAGE_PATTERNS: essa lista usa cacheFirst, que nunca ' +
        'revalida contra a rede — um navegador com uma versão errada em cache ficaria preso nela ' +
        'para sempre. Favicon deve cair no networkFirst padrão (fallback do fetch handler).'
    ).toBe(false);

    // Garante que o guard não quebrou o cache real de imagens de conteúdo.
    expect(pattern.test('/assets/logo.png')).toBe(true);
    expect(pattern.test('/eventos/flyer.webp')).toBe(true);
  });

  it('CACHE_VERSION foi incrementado (força clientes já afetados a descartar o cache antigo)', () => {
    const content = readFileSync(`${process.cwd()}/public/service-worker.js`, 'utf-8');
    const match = content.match(/const CACHE_VERSION = 'v(\d+)'/);
    expect(match, 'CACHE_VERSION não encontrado em public/service-worker.js').not.toBeNull();

    const version = parseInt(match![1], 10);
    expect(
      version,
      'CACHE_VERSION deve ser >= 14 — o bump do fix do favicon (R-028) força o evento "activate" ' +
        'a apagar caches de versões antigas, inclusive um favicon.ico errado preso em cache.'
    ).toBeGreaterThanOrEqual(14);
  });
});
