import { describe, it, expect, beforeAll } from 'vitest';

// Dynamic import keeps Node's `fs` builtin out of Vite's browser build graph.
let readFileSync: typeof import('fs').readFileSync;

beforeAll(async () => {
  const fs = await import(/* @vite-ignore */ 'fs');
  readFileSync = fs.readFileSync;
});

/**
 * R-027 — o <img> do avatar em /links usa a prop `fetchPriority` (camelCase).
 *
 * Histórico: em versões mais antigas do React 18 o suporte a `fetchPriority`
 * ainda não existia e usávamos o atributo HTML nativo `fetchpriority`
 * (minúsculo). Com o React 18.3+ o types passou a exigir camelCase — o
 * atributo minúsculo gera erro TS2322 ("Property 'fetchpriority' does not
 * exist... Did you mean 'fetchPriority'?").
 *
 * Este teste garante que a prop continue no formato aceito pela versão atual
 * do React e não regrida para a forma minúscula.
 */
describe('Links.tsx — avatar usa fetchPriority em camelCase (React 18.3+)', () => {
  it('não reintroduz o atributo HTML minúsculo fetchpriority', () => {
    const content = readFileSync(`${process.cwd()}/src/pages/Links.tsx`, 'utf-8');

    expect(content).toMatch(/fetchPriority=/);
    expect(content).not.toMatch(/fetchpriority=/);
  });
});
