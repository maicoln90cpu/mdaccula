import { describe, it, expect } from 'vitest';
import { sortLinkGroups } from '@/hooks/useLinks';

const g = (name: string, display_order: number) => ({ name, display_order });

describe('sortLinkGroups — ordem de grupos em /links', () => {
  it('coloca Redes Sociais e Navegação no topo', () => {
    const out = sortLinkGroups([
      g('JULHO/26', 202607),
      g('Navegação', 4),
      g('Redes Sociais', 0),
    ]);
    expect(out.map((x) => x.name)).toEqual(['Redes Sociais', 'Navegação', 'JULHO/26']);
  });

  it('ordena grupos de mês cronologicamente independente do display_order', () => {
    const out = sortLinkGroups([
      g('SETEMBRO/26', 18),      // display_order legado baixo
      g('DEZEMBRO/26', 19),
      g('JULHO/26', 202607),
      g('AGOSTO/26', 202608),
      g('OUTUBRO/26', 202610),
    ]);
    expect(out.map((x) => x.name)).toEqual([
      'JULHO/26', 'AGOSTO/26', 'SETEMBRO/26', 'OUTUBRO/26', 'DEZEMBRO/26',
    ]);
  });

  it('mantém temáticos manuais depois dos meses, em display_order', () => {
    const out = sortLinkGroups([
      g('LITORAL SP', 21),
      g('SETEMBRO/26', 18),
      g('GREEN VALLEY - SC', 23),
      g('JULHO/26', 202607),
      g('FIRE UP', 22),
    ]);
    expect(out.map((x) => x.name)).toEqual([
      'JULHO/26', 'SETEMBRO/26', 'LITORAL SP', 'FIRE UP', 'GREEN VALLEY - SC',
    ]);
  });

  it('aceita nome completo (JANEIRO/26) e abreviado (JAN/26)', () => {
    const out = sortLinkGroups([
      g('FEV/26', 100),
      g('JANEIRO/26', 200),
    ]);
    expect(out.map((x) => x.name)).toEqual(['JANEIRO/26', 'FEV/26']);
  });

  it('não confunde REVEILLON 25/26 com um grupo de mês', () => {
    const out = sortLinkGroups([
      g('REVEILLON 25/26', 11),
      g('JULHO/26', 202607),
      g('Redes Sociais', 0),
    ]);
    expect(out.map((x) => x.name)).toEqual([
      'Redes Sociais', 'JULHO/26', 'REVEILLON 25/26',
    ]);
  });
});
