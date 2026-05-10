import { describe, it, expect } from "vitest";
import { getOptimizedImageUrl } from "@/lib/imageUtils";

describe("getOptimizedImageUrl", () => {
  it("retorna '' para null/undefined", () => {
    expect(getOptimizedImageUrl(null)).toBe("");
    expect(getOptimizedImageUrl(undefined)).toBe("");
  });

  it("preserva URL Bunny CDN", () => {
    const url = "https://mdaccula.b-cdn.net/events/cover.webp";
    expect(getOptimizedImageUrl(url)).toBe(url);
  });

  it("converte URL Supabase Storage em Bunny CDN", () => {
    const supa =
      "https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public/events/abc.webp";
    expect(getOptimizedImageUrl(supa)).toBe(
      "https://mdaccula.b-cdn.net/events/abc.webp"
    );
  });

  it("remove parâmetros width/height/resize ao reescrever", () => {
    const supa =
      "https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public/events/abc.webp?width=400&v=1";
    const out = getOptimizedImageUrl(supa);
    expect(out).not.toMatch(/width=400/);
    expect(out).toMatch(/v=1/);
  });

  it("preserva URLs externas que não são Supabase", () => {
    expect(getOptimizedImageUrl("https://example.com/x.png")).toBe(
      "https://example.com/x.png"
    );
  });
});
