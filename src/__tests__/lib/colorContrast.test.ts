import { describe, it, expect } from 'vitest';
import { contrastRatio } from '@/lib/colorContrast';

describe('contrastRatio', () => {
  it('preto vs branco tem contraste máximo (21:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('mesma cor tem contraste mínimo (1:1)', () => {
    expect(contrastRatio('#a855f7', '#a855f7')).toBeCloseTo(1, 5);
  });

  it('é simétrico (ordem dos argumentos não importa)', () => {
    const a = contrastRatio('#333333', '#f5f5f5');
    const b = contrastRatio('#f5f5f5', '#333333');
    expect(a).toBeCloseTo(b!, 5);
  });

  it('aceita hex de 3 dígitos', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 0);
  });

  it('retorna null para hex inválido', () => {
    expect(contrastRatio('not-a-color', '#ffffff')).toBeNull();
    expect(contrastRatio('#ffffff', '')).toBeNull();
  });

  it('duas cores de luminância parecida têm contraste baixo (abaixo de 3:1)', () => {
    const ratio = contrastRatio('#a855f7', '#9333ea');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(3);
  });
});
