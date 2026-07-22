import { describe, it, expect, beforeAll } from 'vitest';

// Dynamic import keeps Node's `fs` builtin out of Vite's browser build graph.
let readFileSync: typeof import('fs').readFileSync;

beforeAll(async () => {
  const fs = await import(/* @vite-ignore */ 'fs');
  readFileSync = fs.readFileSync;
});

/**
 * R-027 — o <img> do avatar em /links usava a prop `fetchPriority` (camelCase),
 * repassada direto ao DOM. React 18 não reconhece essa prop (suporte só chegou
 * no React 19) e loga "React does not recognize the `fetchPriority` prop...".
 * O helper de e2e `assertNoErrors` (e2e/helpers/pageHealth.ts) trata qualquer
 * console.error como falha, então o smoke test de /links quebrava.
 *
 * Correção: usar o atributo HTML nativo `fetchpriority` (lowercase).
 */
describe('Links.tsx — avatar usa fetchpriority em minúsculo', () => {
  it('não reintroduz a prop camelCase fetchPriority', () => {
    const content = readFileSync(`${process.cwd()}/src/pages/Links.tsx`, 'utf-8');

    expect(content).not.toMatch(/fetchPriority=/);
    expect(content).toMatch(/fetchpriority=/);
  });
});
