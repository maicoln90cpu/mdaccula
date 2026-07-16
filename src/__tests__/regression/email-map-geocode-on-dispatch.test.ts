/**
 * Regressão R-006 — bloco de mapa estático vazio no primeiro e-mail de um evento.
 *
 * Bug original (julho/2026):
 *   O bloco `static_map` do e-mail depende de `events.latitude/longitude`, mas
 *   esses campos só eram preenchidos reativamente por `EventLocationMap`
 *   (componente da página pública /eventos/:slug) na primeira visita. O
 *   disparo do e-mail de anúncio normalmente acontece antes de qualquer
 *   visita à página do evento, então o mapa saía vazio (por design —
 *   `emailBlocks.ts` omite o bloco silenciosamente fora do modo preview).
 *
 * Correção:
 *   `dispatchEventDraftEmail` chama a edge function `geocode-event` sob
 *   demanda, antes de montar os dados do e-mail, quando o evento ainda não
 *   tem lat/lng.
 *
 * Este teste é estático (sem rede): garante que a chamada de geocodificação
 * continua presente e posicionada antes de `buildEventData`.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf-8");

describe("Regressão R-006 — geocodificação sob demanda antes do disparo de e-mail", () => {
  it("dispatchEventDraftEmail geocodifica o evento antes de montar os dados do e-mail", () => {
    const src = read("src/lib/emailTemplates/dispatchEventDraft.ts");

    const geocodeCallIndex = src.indexOf('invoke("geocode-event"');
    expect(
      geocodeCallIndex,
      "Não encontrei a chamada a geocode-event em dispatchEventDraft.ts. " +
        "Isso REINTRODUZ a regressão R-006 (mapa vazio no primeiro e-mail do evento). " +
        "Veja docs/TESTING.md → Regressões cobertas."
    ).toBeGreaterThan(-1);

    const buildEventDataCallIndex = src.indexOf("await buildEventData(event)");
    expect(buildEventDataCallIndex, "Não encontrei a chamada buildEventData(event).").toBeGreaterThan(-1);

    expect(
      geocodeCallIndex,
      "A chamada a geocode-event deve acontecer ANTES de buildEventData(event), " +
        "senão o e-mail é montado com latitude/longitude ainda nulos."
    ).toBeLessThan(buildEventDataCallIndex);

    // A geocodificação só deve rodar quando o evento ainda não tem coords —
    // nunca incondicionalmente (evita chamada de rede redundante em todo envio).
    const guardSnippet = src.slice(Math.max(0, geocodeCallIndex - 200), geocodeCallIndex);
    expect(guardSnippet).toMatch(/latitude == null|longitude == null/);
  });
});
