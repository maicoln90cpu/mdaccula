import { describe, it, expect } from "vitest";
import { cn, parseLocalDate } from "@/lib/utils";

describe("utils", () => {
  describe("cn", () => {
    it("merge classes do tailwind sem duplicar", () => {
      expect(cn("p-2", "p-4")).toBe("p-4");
      expect(cn("text-red-500", false && "hidden", "font-bold")).toBe(
        "text-red-500 font-bold"
      );
    });
  });

  describe("parseLocalDate", () => {
    it("não desloca por timezone", () => {
      const d = parseLocalDate("2026-09-19");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(8);
      expect(d.getDate()).toBe(19);
    });
  });
});
