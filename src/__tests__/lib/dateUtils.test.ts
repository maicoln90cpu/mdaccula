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

    it("aceita timeStr null usando 00:00 como fallback (eventos sem horário)", () => {
      const d = parseLocalDateTime("2026-05-23", null);
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
      expect(d.getDate()).toBe(23);
    });

    it("aceita timeStr vazio usando 00:00", () => {
      const d = parseLocalDateTime("2026-05-23", "");
      expect(d.getHours()).toBe(0);
    });
  });

  describe("formatEventDate", () => {
    it("formata 2026-05-23 em pt-BR", () => {
      const out = formatEventDate("2026-05-23");
      expect(out).toMatch(/23/);
      expect(out).toMatch(/2026/);
    });
  });

  describe("formatEventDateRange", () => {
    it("retorna data única quando endDate ausente", () => {
      const out = formatEventDateRange("2026-06-05");
      expect(out).toMatch(/05/);
      expect(out).toMatch(/junho/);
      expect(out).toMatch(/2026/);
      expect(out).not.toMatch(/–/);
    });

    it("retorna data única quando endDate igual a startDate", () => {
      const out = formatEventDateRange("2026-06-05", "2026-06-05");
      expect(out).not.toMatch(/–/);
    });

    it("formata range no mesmo mês com travessão", () => {
      const out = formatEventDateRange("2026-06-05", "2026-06-06");
      expect(out).toMatch(/05.+06/);
      expect(out).toMatch(/junho/);
      expect(out).toMatch(/2026/);
    });

    it("formata range em meses diferentes do mesmo ano", () => {
      const out = formatEventDateRange("2026-05-30", "2026-06-02");
      expect(out).toMatch(/maio/);
      expect(out).toMatch(/junho/);
      expect(out).toMatch(/2026/);
    });

    it("formata range em anos diferentes (Reveillon)", () => {
      const out = formatEventDateRange("2026-12-30", "2027-01-02");
      expect(out).toMatch(/2026/);
      expect(out).toMatch(/2027/);
      expect(out).toMatch(/dezembro/);
      expect(out).toMatch(/janeiro/);
    });
  });
});
