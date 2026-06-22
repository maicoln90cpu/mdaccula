import { describe, it, expect } from "vitest";
import { safeExternalUrl } from "@/lib/safeExternalUrl";

describe("safeExternalUrl", () => {
  it("retorna # para vazio/null/undefined", () => {
    expect(safeExternalUrl(null)).toBe("#");
    expect(safeExternalUrl(undefined)).toBe("#");
    expect(safeExternalUrl("")).toBe("#");
    expect(safeExternalUrl("   ")).toBe("#");
  });

  it("mantém URLs com https://", () => {
    expect(safeExternalUrl("https://sympla.com.br/x")).toBe("https://sympla.com.br/x");
  });

  it("mantém URLs com http://", () => {
    expect(safeExternalUrl("http://exemplo.com")).toBe("http://exemplo.com");
  });

  it("adiciona https:// quando falta protocolo (caso real do bug Vintage)", () => {
    expect(safeExternalUrl("www.sympla.com.br/vintage-culture-em-sp__3378076?afid=112122"))
      .toBe("https://www.sympla.com.br/vintage-culture-em-sp__3378076?afid=112122");
  });

  it("adiciona https:// em encurtadores sem protocolo", () => {
    expect(safeExternalUrl("bit.ly/MDAccula_DEdge_listas"))
      .toBe("https://bit.ly/MDAccula_DEdge_listas");
  });

  it("mantém mailto, tel, sms", () => {
    expect(safeExternalUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeExternalUrl("tel:+5511999999999")).toBe("tel:+5511999999999");
  });

  it("mantém caminhos internos / e #", () => {
    expect(safeExternalUrl("/eventos")).toBe("/eventos");
    expect(safeExternalUrl("#topo")).toBe("#topo");
  });

  it("bloqueia esquemas perigosos (XSS)", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBe("#");
    expect(safeExternalUrl("JaVaScRiPt:alert(1)")).toBe("#");
    expect(safeExternalUrl("data:text/html,<script>")).toBe("#");
  });

  it("trim de espaços", () => {
    expect(safeExternalUrl("  https://x.com  ")).toBe("https://x.com");
  });
});
