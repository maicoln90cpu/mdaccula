import { describe, it, expect, vi } from 'vitest';
import { fetchAllPaginated } from '@/lib/supabasePagination';

describe('fetchAllPaginated', () => {
  it('junta múltiplas páginas quando o resultado excede o teto de 1000 linhas do PostgREST', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }));
    const page2 = Array.from({ length: 250 }, (_, i) => ({ id: `b${i}` }));

    const buildQuery = vi.fn(async (from: number, to: number) => {
      if (from === 0 && to === 999) return { data: page1, error: null };
      if (from === 1000 && to === 1999) return { data: page2, error: null };
      return { data: [], error: null };
    });

    const result = await fetchAllPaginated(buildQuery);

    expect(result).toHaveLength(1250);
    expect(buildQuery).toHaveBeenCalledTimes(2);
  });

  it('uma única página abaixo do teto não gera segunda chamada', async () => {
    const buildQuery = vi.fn(async () => ({ data: [{ id: 'x' }, { id: 'y' }], error: null }));

    const result = await fetchAllPaginated(buildQuery);

    expect(result).toEqual([{ id: 'x' }, { id: 'y' }]);
    expect(buildQuery).toHaveBeenCalledTimes(1);
  });

  it('resultado vazio retorna array vazio', async () => {
    const buildQuery = vi.fn(async () => ({ data: [], error: null }));
    const result = await fetchAllPaginated(buildQuery);
    expect(result).toEqual([]);
  });

  it('propaga erro do Postgrest', async () => {
    const buildQuery = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
    await expect(fetchAllPaginated(buildQuery)).rejects.toThrow('boom');
  });
});
