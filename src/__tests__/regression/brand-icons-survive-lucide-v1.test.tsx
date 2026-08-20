import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StaticIcon } from '@/components/links/StaticIcon';
import { brandIconMap } from '@/components/icons/brandIconMap';

/**
 * R-055 — o `lucide-react` v1 removeu os ícones de marca (Instagram, Facebook,
 * Twitter, LinkedIn, YouTube). Como o nome do ícone dos cards de /links vem do
 * banco, uma remoção silenciosa faria todos virarem o genérico "link externo".
 * Este teste garante que cada marca continua com um ícone próprio e distinto.
 */
describe('R-055: ícones de marca não caem no fallback genérico', () => {
  const brands = ['instagram', 'facebook', 'twitter', 'linkedin', 'youtube'] as const;

  it('mantém um componente próprio para cada marca', () => {
    for (const brand of brands) {
      expect(brandIconMap[brand]).toBeTypeOf('object');
    }
  });

  it('StaticIcon renderiza um SVG diferente do fallback para cada marca', () => {
    const { container: fallback } = render(<StaticIcon name="algo-que-nao-existe" />);
    const fallbackMarkup = fallback.innerHTML;

    for (const brand of brands) {
      const { container } = render(<StaticIcon name={brand} />);
      const svg = container.querySelector('svg');
      expect(svg, `ícone ausente para ${brand}`).not.toBeNull();
      expect(container.innerHTML, `${brand} caiu no fallback genérico`).not.toBe(fallbackMarkup);
    }
  });
});
