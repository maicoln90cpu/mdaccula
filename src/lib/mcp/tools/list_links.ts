import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_links",
  title: "Listar links públicos (Linktree)",
  description:
    "Lista os links públicos ativos da página de links da MDAccula (estilo Linktree), agrupados por seção.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("link_groups")
      .select(
        "id, name, slug, display_order, enabled, custom_links(id, title, subtitle, url, is_featured, display_order, enabled)",
      )
      .eq("enabled", true)
      .order("display_order", { ascending: true });
    if (error) {
      return { content: [{ type: "text", text: `Erro: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { groups: data ?? [] },
    };
  },
});
