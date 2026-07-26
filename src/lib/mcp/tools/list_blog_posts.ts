declare const Deno: { env: { get(k: string): string | undefined } };
import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_blog_posts",
  title: "Listar posts do blog",
  description:
    "Lista os posts publicados no blog da MDAccula, do mais recente ao mais antigo. Suporta filtro por categoria e busca por palavra-chave.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10),
    category: z.string().trim().optional().describe("Filtrar por categoria (opcional)."),
    search: z.string().trim().optional().describe("Buscar por termo no título ou resumo (opcional)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, category, search }) => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let query = supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, category, image_url, views, likes, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (category) query = query.eq("category", category);
    if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: `Erro: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { posts: data ?? [] },
    };
  },
});
