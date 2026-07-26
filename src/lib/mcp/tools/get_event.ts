declare const Deno: { env: { get(k: string): string | undefined } };
import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_event",
  title: "Detalhes de um evento",
  description:
    "Retorna os detalhes completos de um evento MDAccula pelo slug (ex.: 'parador-reveillon'). Inclui line-up, descrição, horários e link de ingresso.",
  inputSchema: {
    slug: z.string().trim().min(1).describe("Slug do evento (URL)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, subtitle, slug, venue, address, location_city, location_state, date, end_date, time, end_time, genres, lineup, description, schedule, ticket_link, vip_link, image_url, latitude, longitude",
      )
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: `Erro: ${error.message}` }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: `Evento '${slug}' não encontrado.` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { event: data },
    };
  },
});
