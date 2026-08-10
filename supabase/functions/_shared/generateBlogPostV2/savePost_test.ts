import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { saveOrUpdatePost } from "./savePost.ts";

// deno-lint-ignore no-explicit-any
function mockSupabase(insertedRow: any) {
  return {
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
      }),
      insert: (payload: unknown) => ({
        select: () => ({
          single: () => Promise.resolve({ data: { ...insertedRow, ...(payload as object) }, error: null }),
        }),
      }),
    }),
  };
}

const baseParams = {
  eventData: { title: "Artigo real", excerpt: "resumo", content: "" },
  finalCategory: "Eventos",
  generatedImageUrl: null,
  slug: "artigo-real",
};

Deno.test("saveOrUpdatePost: item #2 — conteúdo curto força published=false mesmo com publishImmediately implícito (true)", async () => {
  // deno-lint-ignore no-explicit-any
  const supabase = mockSupabase({}) as any;
  const { post, downgradedForQuality } = await saveOrUpdatePost(supabase, {
    ...baseParams,
    eventData: { ...baseParams.eventData, content: "<p>Muito curto.</p>" },
  });
  assertEquals(post.published, false);
  assertEquals(post.published_at, null);
  assertEquals(downgradedForQuality, true);
});

Deno.test("saveOrUpdatePost: conteúdo substancial publica normalmente quando publishImmediately não é false", async () => {
  const longContent = `<p>${"Parágrafo real com bastante conteúdo de verdade. ".repeat(20)}</p>`;
  // deno-lint-ignore no-explicit-any
  const supabase = mockSupabase({}) as any;
  const { post, downgradedForQuality } = await saveOrUpdatePost(supabase, {
    ...baseParams,
    eventData: { ...baseParams.eventData, content: longContent },
  });
  assertEquals(post.published, true);
  assertEquals(downgradedForQuality, false);
});

Deno.test("saveOrUpdatePost: publishImmediately=false sempre vira rascunho, mesmo com conteúdo substancial (downgradedForQuality=false, é opção do usuário, não falha de qualidade)", async () => {
  const longContent = `<p>${"Parágrafo real com bastante conteúdo de verdade. ".repeat(20)}</p>`;
  // deno-lint-ignore no-explicit-any
  const supabase = mockSupabase({}) as any;
  const { post, downgradedForQuality } = await saveOrUpdatePost(supabase, {
    ...baseParams,
    publishImmediately: false,
    eventData: { ...baseParams.eventData, content: longContent },
  });
  assertEquals(post.published, false);
  assertEquals(downgradedForQuality, false);
});
