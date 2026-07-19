/**
 * Regressão — KPIs de LinksAnalytics.tsx (cliques/views) travavam em 1000 quando
 * um filtro de data era aplicado.
 *
 * Causa: as queries a link_click_events/blog_view_events/event_view_events/
 * redirect_click_events eram um select() simples sem paginação — o PostgREST
 * trunca silenciosamente em 1000 linhas por request (max_rows padrão, sem
 * override em supabase/config.toml). fetchAllPaginated (src/lib/supabasePagination.ts)
 * é a proteção: pagina em blocos de 1000 até esgotar o resultado real.
 */
import { describe, it, expect, vi } from 'vitest';
import { fetchAllPaginated } from '@/lib/supabasePagination';

describe('Regressão — LinksAnalytics não trunca mais em 1000 linhas com filtro de data', () => {
  it('soma corretamente um período com mais de 1000 eventos de clique/view', async () => {
    const totalRows = 1347;
    const allRows = Array.from({ length: totalRows }, (_, i) => ({ link_id: `link-${i % 5}` }));

    const buildQuery = vi.fn(async (from: number, to: number) => ({
      data: allRows.slice(from, to + 1),
      error: null,
    }));

    const result = await fetchAllPaginated(buildQuery);

    expect(result).toHaveLength(totalRows);
    // Antes da correção, um select() sem paginação teria voltado no máximo 1000 linhas.
    expect(result.length).toBeGreaterThan(1000);
  });
});
