import { describe, it, expect } from "vitest";
import { parseLocalDateTime, formatEventDate, formatEventDateRange } from "@/lib/dateUtils";

describe("dateUtils", () => {
  describe("parseLocalDateTime", () => {
    it("combina data + hora respeitando fuso local", () => {
      const d = parseLocalDateTime("2026-05-23", "21:30");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(4);
      expect(d.getDate()).toBe(23);
      expect(d.getHours()).toBe(21);
      expect(d.getMinutes()).toBe(30);
    });

    it("aceita time sem minutos", () => {
      const d = parseLocalDateTime("2026-01-01", "08");
      expect(d.getHours()).toBe(8);
      expect(d.getMinutes()).toBe(0);
    });
  });

  describe("formatEventDate", () => {
    it("formata 2026-05-23 em pt-BR", () => {
      const out = formatEventDate("2026-05-23");
      expect(out).toMatch(/23/);
      expect(out).toMatch(/2026/);
    });
  });
});
