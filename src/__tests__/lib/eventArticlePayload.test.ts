import { describe, it, expect } from "vitest";
import {
  weekdayPtBr,
  dateFormattedPtBr,
  buildArticlePayload,
} from "@/lib/eventArticlePayload";

describe("eventArticlePayload helpers", () => {
  describe("weekdayPtBr", () => {
    it("retorna '' quando data inválida", () => {
      expect(weekdayPtBr("")).toBe("");
      expect(weekdayPtBr("invalid")).toBe("");
    });

    it("retorna sábado para 2026-09-19 (sem shift de UTC)", () => {
      // Bug clássico: new Date('2026-09-19') retorna sexta em UTC-3.
      expect(weekdayPtBr("2026-09-19")).toBe("sábado");
    });

    it("retorna domingo para 2026-05-10", () => {
      expect(weekdayPtBr("2026-05-10")).toBe("domingo");
    });
  });

  describe("dateFormattedPtBr", () => {
    it("formata 2026-05-10 como '10 de maio de 2026'", () => {
      expect(dateFormattedPtBr("2026-05-10")).toMatch(/10 de maio de 2026/);
    });
  });

  describe("buildArticlePayload", () => {
    it("inclui weekday calculado e ai_context cortesia", () => {
      const payload = buildArticlePayload({
        title: "TANTRAROSA",
        date: "2026-05-23",
        venue: "Varanda Estaiada",
        location_city: "São Paulo",
        location_state: "SP",
        ai_context: "Evento gratuito, sem ingresso, cortesia pelo link.",
      });
      expect(payload).toMatchObject({
        weekday: "sábado",
        ai_context: expect.stringContaining("cortesia"),
      });
    });

    it("propaga lineup, genres e ticket_link", () => {
      const payload = buildArticlePayload({
        title: "X",
        date: "2026-06-01",
        venue: "Y",
        location_city: "Z",
        location_state: "SP",
        lineup: ["Artista A", "Artista B"],
        genres: ["techno"],
        ticket_link: "https://ex.com/t",
      });
      expect(payload.lineup).toEqual(["Artista A", "Artista B"]);
      expect(payload.genres).toEqual(["techno"]);
      expect(payload.ticketLink).toBe("https://ex.com/t");
    });
  });
});
