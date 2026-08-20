import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

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
});
