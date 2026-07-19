import { describe, it, expect } from 'vitest';
import { generateEventGroupName } from '@/lib/eventGroupHelper';

describe('generateEventGroupName', () => {
  it('retorna REVEILLON 25/26 entre 27/12/2025 e 03/01/2026', () => {
    expect(generateEventGroupName('2025-12-27')).toBe('REVEILLON 25/26');
    expect(generateEventGroupName('2025-12-31')).toBe('REVEILLON 25/26');
    expect(generateEventGroupName('2026-01-03')).toBe('REVEILLON 25/26');
  });

  it('não considera reveillon fora da janela', () => {
    expect(generateEventGroupName('2025-12-26')).toBe('DEZEMBRO/25');
    expect(generateEventGroupName('2026-01-04')).toBe('JANEIRO/26');
  });

  it('formata MES/AA padrão', () => {
    expect(generateEventGroupName('2026-05-10')).toBe('MAIO/26');
    expect(generateEventGroupName('2026-12-15')).toBe('DEZEMBRO/26');
  });
});
