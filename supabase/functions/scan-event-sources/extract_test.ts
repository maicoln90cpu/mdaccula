import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildExtractionRequest, parseExtractionResponse } from "./extract.ts";

Deno.test("buildExtractionRequest monta tool-call com o modelo e a fonte corretos", () => {
  const body = buildExtractionRequest("google/gemini-2.5-flash", { name: "Site X", url: "https://x.test" }, "conteúdo raspado aqui") as any;
  assertEquals(body.model, "google/gemini-2.5-flash");
  assertEquals(body.tool_choice.function.name, "extract_event");
  assert(String(body.messages[1].content).includes("Site X"));
  assert(String(body.messages[1].content).includes("conteúdo raspado aqui"));
});

Deno.test("parseExtractionResponse retorna null quando has_event é false", () => {
  const aiData = {
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({ has_event: false, confidence: "low" }),
          },
        }],
      },
    }],
  };
  assertEquals(parseExtractionResponse(aiData), null);
});

Deno.test("parseExtractionResponse retorna null quando não há tool_call", () => {
  assertEquals(parseExtractionResponse({ choices: [{ message: {} }] }), null);
});

Deno.test("parseExtractionResponse extrai os campos do evento quando has_event é true", () => {
  const aiData = {
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({
              has_event: true,
              confidence: "high",
              title: "Sun Festival",
              date: "2026-09-19",
              time: "22:00",
              venue: "Arena X",
              address: "Rua Y, 123",
              location_city: "São Paulo",
              location_state: "SP",
              lineup: ["DJ A", "DJ B"],
              ticket_link: "https://ingressos.test/sun",
              description: "Um festival de música eletrônica.",
            }),
          },
        }],
      },
    }],
  };
  const result = parseExtractionResponse(aiData);
  assert(result !== null);
  assertEquals(result!.title, "Sun Festival");
  assertEquals(result!.date, "2026-09-19");
  assertEquals(result!.lineup.length, 2);
  assertEquals(result!.confidence, "high");
});

Deno.test("parseExtractionResponse retorna null quando o JSON dos argumentos é inválido", () => {
  const aiData = {
    choices: [{
      message: {
        tool_calls: [{ function: { arguments: "{not-json" } }],
      },
    }],
  };
  assertEquals(parseExtractionResponse(aiData), null);
});

Deno.test("parseExtractionResponse retorna null quando os argumentos são o literal JSON null", () => {
  const aiData = {
    choices: [{
      message: {
        tool_calls: [{ function: { arguments: "null" } }],
      },
    }],
  };
  assertEquals(parseExtractionResponse(aiData), null);
});

Deno.test("parseExtractionResponse extrai image_url quando é uma URL http(s) válida", () => {
  const aiData = {
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({
              has_event: true,
              confidence: "medium",
              title: "Sun Festival",
              date: "2026-09-19",
              image_url: "https://site.test/flyers/sun-festival.jpg",
            }),
          },
        }],
      },
    }],
  };
  const result = parseExtractionResponse(aiData);
  assertEquals(result!.image_url, "https://site.test/flyers/sun-festival.jpg");
});

Deno.test("parseExtractionResponse descarta image_url que não é http(s) (nunca inventa)", () => {
  const aiData = {
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({
              has_event: true,
              confidence: "medium",
              title: "Sun Festival",
              date: "2026-09-19",
              image_url: "data:image/png;base64,abc123",
            }),
          },
        }],
      },
    }],
  };
  const result = parseExtractionResponse(aiData);
  assertEquals(result!.image_url, null);
});
