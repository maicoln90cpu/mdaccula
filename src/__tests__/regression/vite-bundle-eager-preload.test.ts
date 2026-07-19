/**
 * Regressão R-010 — landing/site inteiro carregando ~991KB desnecessários
 * sempre, em toda página (icons + charts em modulepreload eager).
 *
 * Bug original (julho/2026):
 *   `manualChunks` em vite.config.ts agrupava TODO o pacote lucide-react
 *   ('icons') e TODO o recharts ('charts') em dois chunks únicos. Como
 *   `ErrorBoundary`/`Toast` (montados eager na raiz do App.tsx) importam
 *   alguns ícones, o Rollup tratava o chunk 'icons' INTEIRO — usado em
 *   qualquer página, inclusive admin — como dependência estática de toda
 *   rota. Resultado: ~574KB (icons) + ~417KB (charts) sempre em
 *   `<link rel="modulepreload">` no index.html raiz, mesmo em páginas que
 *   não usam nada disso.
 *
 * Correção:
 *   Removidos os agrupamentos 'icons'/'charts' de manualChunks — o Rollup
 *   volta a fazer chunking automático por uso real (cada ícone/gráfico vira
 *   um chunk pequeno, carregado só pela página que o importa).
 *
 * Este teste é estático (sem build/rede): lê vite.config.ts e garante que
 * ninguém reintroduza esses dois agrupamentos.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-010 — manualChunks não deve forçar icons/charts eager em toda página', () => {
  it('vite.config.ts não agrupa lucide-react/recharts como chunk manual único', () => {
    const config = read('vite.config.ts');
    const manualChunksMatch = config.match(/manualChunks:\s*\{[\s\S]*?\n\s*\},/);
    expect(manualChunksMatch, 'Não encontrei o bloco manualChunks em vite.config.ts.').toBeTruthy();

    const block = manualChunksMatch![0];

    expect(
      block,
      "manualChunks voltou a agrupar 'icons' (lucide-react) como chunk único. Isso REINTRODUZ a " +
        'regressão R-010: ErrorBoundary/Toast importam ícones eager na raiz, então o Rollup trata o ' +
        'pacote INTEIRO de ícones (usado em qualquer página, inclusive admin) como dependência ' +
        'estática de toda rota — ~574KB sempre em modulepreload no index.html. ' +
        'Veja docs/TESTING.md → Regressões cobertas → R-010.'
    ).not.toMatch(/['"]icons['"]\s*:/);

    expect(
      block,
      "manualChunks voltou a agrupar 'charts' (recharts) como chunk único, reintroduzindo a mesma " +
        'regressão R-010 (~417KB sempre em modulepreload, mesmo fora de páginas com gráfico). ' +
        'Veja docs/TESTING.md → Regressões cobertas → R-010.'
    ).not.toMatch(/['"]charts['"]\s*:/);

    expect(block, "'lucide-react' não deveria aparecer dentro de manualChunks.").not.toMatch(
      /lucide-react/
    );
    expect(block, "'recharts' não deveria aparecer dentro de manualChunks.").not.toMatch(
      /recharts/
    );
  });
});
