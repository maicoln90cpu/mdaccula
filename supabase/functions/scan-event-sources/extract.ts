export interface ExtractedEvent {
  title: string;
  date: string;
  time: string | null;
  venue: string | null;
  address: string | null;
  location_city: string | null;
  location_state: string | null;
  lineup: string[];
  ticket_link: string | null;
  description: string | null;
  confidence: "high" | "medium" | "low";
}

const EXTRACTION_SYSTEM_PROMPT = `Você é um assistente que extrai dados estruturados de anúncios de eventos de música eletrônica a partir de texto raspado de sites de terceiros.

Regras:
- Extraia apenas informações EXPLICITAMENTE presentes no texto. NUNCA invente data, local, horário ou lineup.
- Se o conteúdo não anuncia nenhum evento (ex: página institucional, notícia genérica, index de blog), retorne has_event=false.
- Se um campo não está claro no texto, deixe-o nulo/vazio — nunca adivinhe.
- confidence="high" só quando data, local e nome do evento estão todos claramente presentes; "medium" quando falta 1 desses; "low" caso contrário.`;

export function buildExtractionRequest(
  modelName: string,
  source: { name: string; url: string },
  markdown: string,
): Record<string, unknown> {
  const userPrompt = `Fonte: ${source.name} (${source.url})\n\nConteúdo raspado:\n${markdown}\n\nExtraia os dados do evento anunciado neste conteúdo, se houver algum.`;

  return {
    model: modelName,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "extract_event",
          description: "Extrai dados estruturados de um evento de música eletrônica anunciado no texto, se houver",
          parameters: {
            type: "object",
            properties: {
              has_event: { type: "boolean", description: "true se o texto anuncia um evento real" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              title: { type: "string" },
              date: { type: "string", description: "Formato YYYY-MM-DD" },
              time: { type: "string", description: "Formato HH:MM, 24h" },
              venue: { type: "string" },
              address: { type: "string" },
              location_city: { type: "string" },
              location_state: { type: "string", description: "UF de 2 letras" },
              lineup: { type: "array", items: { type: "string" } },
              ticket_link: { type: "string" },
              description: { type: "string" },
            },
            required: ["has_event", "confidence"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "extract_event" } },
  };
}

export function parseExtractionResponse(aiData: unknown): ExtractedEvent | null {
  const toolCall = (aiData as any)?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return null;

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return null;
  }

  if (args.has_event !== true) return null;
  if (typeof args.title !== "string" || typeof args.date !== "string") return null;

  return {
    title: args.title,
    date: args.date,
    time: typeof args.time === "string" && args.time ? args.time : null,
    venue: typeof args.venue === "string" && args.venue ? args.venue : null,
    address: typeof args.address === "string" && args.address ? args.address : null,
    location_city: typeof args.location_city === "string" && args.location_city ? args.location_city : null,
    location_state: typeof args.location_state === "string" && args.location_state ? args.location_state : null,
    lineup: Array.isArray(args.lineup) ? args.lineup.filter((x): x is string => typeof x === "string") : [],
    ticket_link: typeof args.ticket_link === "string" && args.ticket_link ? args.ticket_link : null,
    description: typeof args.description === "string" && args.description ? args.description : null,
    confidence: (["high", "medium", "low"].includes(args.confidence as string) ? args.confidence : "low") as "high" | "medium" | "low",
  };
}
