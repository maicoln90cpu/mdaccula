// Função pura (sem I/O) que remove do "Blog news" posts cujo evento vinculado
// já passou — testável isoladamente via `npm run test:edge` (pastEventFilter_test.ts).

export interface EventDateLink {
  blog_post_id: string | null;
  date: string; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD | null
}

/**
 * Remove da lista de posts qualquer um cujo(s) evento(s) vinculado(s)
 * (`events.blog_post_id`) já tenham todos passado — comparando `end_date`
 * (ou `date`, se o evento não for de vários dias) contra `todayIso`.
 *
 * Posts sem nenhum evento vinculado nunca são afetados (a grande maioria —
 * artigos de opinião, notícias gerais). Se um post tiver mais de um evento
 * vinculado e pelo menos um deles ainda estiver por vir, o post continua na
 * lista — só é removido quando TODOS os eventos vinculados já passaram.
 *
 * Comparação é por string "YYYY-MM-DD" (lexicograficamente ordenável),
 * evitando os problemas de fuso de `new Date("YYYY-MM-DD")` — ver
 * `parseLocalDate` em `src/lib/utils.ts` para o mesmo cuidado no frontend.
 */
export function filterOutPastEventPosts<T extends { id: string }>(
  posts: T[],
  eventLinks: EventDateLink[],
  todayIso: string,
): T[] {
  const linksByPost = new Map<string, EventDateLink[]>();
  for (const link of eventLinks) {
    if (!link.blog_post_id) continue;
    const arr = linksByPost.get(link.blog_post_id) ?? [];
    arr.push(link);
    linksByPost.set(link.blog_post_id, arr);
  }

  return posts.filter((post) => {
    const links = linksByPost.get(post.id);
    if (!links || links.length === 0) return true;
    return links.some((link) => (link.end_date ?? link.date) >= todayIso);
  });
}
