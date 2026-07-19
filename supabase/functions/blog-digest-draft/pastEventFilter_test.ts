import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { filterOutPastEventPosts, type EventDateLink } from "./pastEventFilter.ts";

// Regressão — o "Blog news" enviava artigos atrelados a eventos já
// encerrados (ex.: evento de 17/07 mandado no e-mail de domingo 19/07,
// já desativado). A query original só olhava `published`/`published_at`,
// nunca `events.blog_post_id`. Ver R-022 em docs/TESTING.md.

const TODAY = "2026-07-19";

Deno.test("filterOutPastEventPosts: post sem evento vinculado nunca é removido", () => {
  const posts = [{ id: "p1" }];
  const result = filterOutPastEventPosts(posts, [], TODAY);
  assertEquals(result, posts);
});

Deno.test("filterOutPastEventPosts: remove post cujo evento já passou (data < hoje)", () => {
  const posts = [{ id: "krush" }];
  const links: EventDateLink[] = [{ blog_post_id: "krush", date: "2026-07-17", end_date: null }];
  const result = filterOutPastEventPosts(posts, links, TODAY);
  assertEquals(result, []);
});

Deno.test("filterOutPastEventPosts: mantém post cujo evento ainda vai acontecer", () => {
  const posts = [{ id: "futuro" }];
  const links: EventDateLink[] = [{ blog_post_id: "futuro", date: "2026-07-25", end_date: null }];
  const result = filterOutPastEventPosts(posts, links, TODAY);
  assertEquals(result, posts);
});

Deno.test("filterOutPastEventPosts: mantém post cujo evento é HOJE (não é 'passado')", () => {
  const posts = [{ id: "hoje" }];
  const links: EventDateLink[] = [{ blog_post_id: "hoje", date: TODAY, end_date: null }];
  const result = filterOutPastEventPosts(posts, links, TODAY);
  assertEquals(result, posts);
});

Deno.test("filterOutPastEventPosts: evento de vários dias usa end_date, não date", () => {
  // Começou antes de hoje mas ainda não terminou — não é passado.
  const posts = [{ id: "festival" }];
  const links: EventDateLink[] = [{ blog_post_id: "festival", date: "2026-07-15", end_date: "2026-07-21" }];
  const result = filterOutPastEventPosts(posts, links, TODAY);
  assertEquals(result, posts);
});

Deno.test("filterOutPastEventPosts: evento de vários dias já encerrado (end_date < hoje) é removido", () => {
  const posts = [{ id: "festival" }];
  const links: EventDateLink[] = [{ blog_post_id: "festival", date: "2026-07-10", end_date: "2026-07-15" }];
  const result = filterOutPastEventPosts(posts, links, TODAY);
  assertEquals(result, []);
});

Deno.test("filterOutPastEventPosts: mantém post se PELO MENOS UM evento vinculado ainda está por vir", () => {
  const posts = [{ id: "multi" }];
  const links: EventDateLink[] = [
    { blog_post_id: "multi", date: "2026-07-10", end_date: null },
    { blog_post_id: "multi", date: "2026-07-30", end_date: null },
  ];
  const result = filterOutPastEventPosts(posts, links, TODAY);
  assertEquals(result, posts);
});

Deno.test("filterOutPastEventPosts: remove só se TODOS os eventos vinculados já passaram", () => {
  const posts = [{ id: "multi" }];
  const links: EventDateLink[] = [
    { blog_post_id: "multi", date: "2026-07-10", end_date: null },
    { blog_post_id: "multi", date: "2026-07-05", end_date: null },
  ];
  const result = filterOutPastEventPosts(posts, links, TODAY);
  assertEquals(result, []);
});

Deno.test("filterOutPastEventPosts: filtra em lista mista — mantém só os sem evento passado", () => {
  const posts = [
    { id: "sem-evento" },
    { id: "evento-passado" },
    { id: "evento-futuro" },
  ];
  const links: EventDateLink[] = [
    { blog_post_id: "evento-passado", date: "2026-07-01", end_date: null },
    { blog_post_id: "evento-futuro", date: "2026-08-01", end_date: null },
  ];
  const result = filterOutPastEventPosts(posts, links, TODAY);
  assertEquals(result.map((p) => p.id), ["sem-evento", "evento-futuro"]);
});

Deno.test("filterOutPastEventPosts: ignora link com blog_post_id nulo (evento sem artigo vinculado)", () => {
  const posts = [{ id: "p1" }];
  const links: EventDateLink[] = [{ blog_post_id: null, date: "2026-07-01", end_date: null }];
  const result = filterOutPastEventPosts(posts, links, TODAY);
  assertEquals(result, posts);
});
