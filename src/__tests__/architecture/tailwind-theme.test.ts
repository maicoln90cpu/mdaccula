import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

const listSourceFiles = (dir: string): string[] =>
  readdirSync(resolve(process.cwd(), dir)).flatMap((name) => {
    const relative = join(dir, name);
    const abs = resolve(process.cwd(), relative);
    if (statSync(abs).isDirectory()) return listSourceFiles(relative);
    return /\.(ts|tsx)$/.test(name) ? [relative] : [];
  });

/**
 * Guarda de regressao da migracao Tailwind v3 -> v4 (tokens em @theme).
 * Bug real: tokens de spacing chamados 'xs'/'2xl'/'3xl' sequestravam as
 * classes max-w-* (max-w-2xl virava 48px) e quebravam o layout da home/blog.
 */
describe('tailwind v4 theme', () => {
  it('nao define tokens de spacing que colidem com max-w-*', () => {
    expect(css).not.toMatch(/--spacing-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\s*:/);
  });

  it('usa CSS-first (@theme) e nao o config legado', () => {
    expect(css).toContain('@theme');
    expect(css).not.toContain('@config');
    expect(existsSync(resolve(process.cwd(), 'tailwind.config.ts'))).toBe(false);
  });

  it('mantem dark mode por classe e o plugin de animacao', () => {
    expect(css).toContain('@custom-variant dark (&:is(.dark *))');
    expect(css).toContain("@plugin 'tailwindcss-animate'");
  });

  it('mantem os tokens de marca essenciais', () => {
    for (const token of ['--color-primary:', '--color-background:', '--font-display:', '--shadow-xs:']) {
      expect(css).toContain(token);
    }
  });

  /**
   * Regressao R-081 — no Tailwind v3, `w-[--minha-var]` era um atalho que o
   * compilador convertia automaticamente para `width: var(--minha-var)`. O
   * v4 nao faz mais essa conversao: `w-[--minha-var]` vira CSS invalido
   * (`width: --minha-var`, sem `var()`), o navegador descarta a regra
   * inteira, e o elemento fica sem a medida — foi exatamente isso que
   * colapsou a largura do menu admin (AdminSidebar) pra 0 e deixou o menu
   * flutuando por cima do conteudo (bug real reportado com print). O v4
   * expõe a sintaxe `w-(--minha-var)` pra esse caso — ja corrigida em
   * sidebar.tsx/chart.tsx; este teste impede qualquer arquivo novo (ou
   * componente colado de um exemplo v3) de reintroduzir o padrao antigo.
   */
  it('nenhum arquivo usa `[--variavel]` como valor arbitrario sem var() (quebra no Tailwind v4)', () => {
    const invalidPattern = /\[--[a-zA-Z][\w-]*\]/g;
    const files = listSourceFiles('src').filter((f) => !f.includes('__tests__'));
    const violations = files.flatMap((file) => {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      const matches = source.match(invalidPattern);
      return matches ? matches.map((m) => `${file}: ${m}`) : [];
    });

    expect(
      violations,
      `Uso de valor arbitrario "[--var]" sem var() encontrado (CSS invalido no Tailwind v4 — use "(--var)"):\n${violations.join('\n')}`
    ).toEqual([]);
  });
});
