/**
 * O PostgREST tem um teto padrão de 1000 linhas por requisição (sem override em
 * supabase/config.toml). Um select() simples sem paginação trunca silenciosamente
 * qualquer resultado com mais de 1000 linhas — usar pra buscar o conjunto completo
 * em blocos de 1000 até esgotar.
 */
export async function fetchAllPaginated<T>(
  buildQuery: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const results: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await buildQuery(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return results;
}
