import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_upcoming_events",
  title: "Listar próximos eventos",
  description:
    "Retorna os próximos eventos publicados da MDAccula (São Paulo), ordenados por data crescente. Inclui título, local, data, gêneros e link do evento.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Quantidade máxima de eventos a retornar (1-50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, subtitle, slug, venue, address, location_city, location_state, date, end_date, time, genres, ticket_link, image_url",
      )
      .eq("status", "published")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(limit);
    if (error) {
      return { content: [{ type: "text", text: `Erro: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { events: data ?? [] },
    };
  },
});
